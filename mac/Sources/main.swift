// NOTOS Bots voor macOS: een venster om de app, en een updatekanaal dat ik van afstand voed.
//
// De schil doet drie dingen en verder niets. Ze tekent een venster met de app erin, ze kiest
// tussen de gedeelde NOTOS en een server die op deze Mac zelf draait, en ze haalt bij het starten
// op of er een nieuwe versie klaarstaat. Alles wat met processen te maken heeft (Postgres starten,
// migraties draaien, de server opstarten) staat in `local-server.sh` naast deze schil: dat is
// leesbaar shellwerk en het hoort niet in de UI-laag.

import AppKit
import CryptoKit
import WebKit

// MARK: - Waar dingen staan

enum Paths {
    /// De map waar deze installatie haar eigen spullen bewaart: database, sleutel, logboek.
    /// Buiten de app-bundel, zodat een update niets van de gebruiker weggooit.
    static let support: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let directory = base.appendingPathComponent("NOTOS Bots", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }()

    static var settingsFile: URL { support.appendingPathComponent("settings.json") }
    static var logFile: URL { support.appendingPathComponent("logs/app.log") }

    static var bundleResources: URL {
        Bundle.main.resourceURL ?? URL(fileURLWithPath: ".")
    }
}

func log(_ message: String) {
    let line = "\(ISO8601DateFormatter().string(from: Date()))  \(message)\n"
    let file = Paths.logFile
    try? FileManager.default.createDirectory(
        at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
    if let handle = try? FileHandle(forWritingTo: file) {
        handle.seekToEndOfFile()
        handle.write(Data(line.utf8))
        try? handle.close()
    } else {
        try? Data(line.utf8).write(to: file)
    }
    FileHandle.standardError.write(Data(line.utf8))
}

// MARK: - Instellingen

/// Waar de app zijn inhoud vandaan haalt.
///
/// `shared` is de NOTOS die het hele team deelt: één database, en wat ik deploy heeft iedereen
/// meteen. `local` draait de server op deze Mac, met een database die alleen van deze persoon is.
/// Dat laatste betekent dus ook: geen gedeelde workspaces, campagnes of goedkeuringen.
enum Mode: String, Codable {
    case shared
    case local
}

struct Settings: Codable {
    /// Lokaal is de stand waarvoor deze app gemaakt is: alles draait op deze Mac. Wie liever met
    /// het team in dezelfde NOTOS werkt, zet hem in het menu Weergave op gedeeld.
    var mode: Mode = .local
    var sharedURL: String = "https://notos.zuid.com/bots/"
    var localPort: Int = 3011
    /// Waar de app kijkt of er een nieuwe versie is. Leeg = niet kijken.
    var updateFeed: String = "https://notos.zuid.com/bots/mac/appcast.json"
    var checkForUpdates: Bool = true
    /// Of de uitleg over de twee standen al een keer getoond is.
    var explained: Bool = false

    static func load() -> Settings {
        guard let data = try? Data(contentsOf: Paths.settingsFile),
              let settings = try? JSONDecoder().decode(Settings.self, from: data)
        else { return Settings() }
        return settings
    }

    func save() {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try? encoder.encode(self).write(to: Paths.settingsFile)
    }
}

// MARK: - De lokale server

/// Start en stopt `local-server.sh`, en wacht tot de server antwoordt.
///
/// Het script is de baas over Postgres en de twee binaries; deze klasse kent alleen het proces en
/// de poort. Bij afsluiten krijgt de hele procesgroep een TERM, anders blijft Postgres draaien
/// nadat het venster al weg is.
final class LocalServer {
    private var process: Process?
    private let port: Int

    init(port: Int) { self.port = port }

    var isRunning: Bool { process?.isRunning ?? false }

    func start() throws {
        guard process == nil else { return }
        let script = Paths.bundleResources.appendingPathComponent("scripts/local-server.sh")
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/bin/bash")
        task.arguments = [script.path]
        task.environment = [
            "NOTOS_BOTS_RESOURCES": Paths.bundleResources.path,
            "NOTOS_BOTS_SUPPORT": Paths.support.path,
            "NOTOS_BOTS_PORT": String(port),
            "PATH": "/usr/bin:/bin:/usr/sbin:/sbin",
        ]
        let out = FileHandle(forWritingAtPath: Paths.logFile.path)
        out?.seekToEndOfFile()
        task.standardOutput = out ?? FileHandle.nullDevice
        task.standardError = out ?? FileHandle.nullDevice
        try task.run()
        process = task
        log("lokale server gestart (pid \(task.processIdentifier), poort \(port))")
    }

    func stop() {
        guard let task = process, task.isRunning else { return }
        // De procesgroep, niet alleen het script: Postgres en de server zijn kinderen.
        kill(-task.processIdentifier, SIGTERM)
        task.terminate()
        process = nil
        log("lokale server gestopt")
    }

    /// Wacht tot `/health` antwoordt. Geeft false terug als dat binnen de tijd niet lukt.
    func waitUntilReady(timeout: TimeInterval = 90) async -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        let url = URL(string: "http://127.0.0.1:\(port)/health")!
        while Date() < deadline {
            var request = URLRequest(url: url)
            request.timeoutInterval = 2
            if let (_, response) = try? await URLSession.shared.data(for: request),
               let http = response as? HTTPURLResponse, http.statusCode == 200
            {
                return true
            }
            try? await Task.sleep(nanoseconds: 1_000_000_000)
        }
        return false
    }
}

// MARK: - Bijwerken

/// Wat er in het manifest staat dat ik publiceer.
struct Appcast: Decodable {
    let version: Int
    let shortVersion: String
    let url: String
    /// Hex van de SHA-256 van de zip. De schil weigert een download die hier niet aan voldoet.
    let sha256: String
    let notes: String?
    /// Zet dit op true en de app werkt zichzelf bij zonder te vragen.
    let mandatory: Bool?
}

enum UpdateOutcome {
    case upToDate
    case installed
    case declined
    case failed(String)
}

/// Haalt het manifest op, controleert de zip tegen de opgegeven hash, en zet de nieuwe app op de
/// plek van de oude.
///
/// Dit is bewust geen Sparkle. De app is niet ondertekend met een Apple-certificaat (ZUID heeft er
/// geen), dus de handtekeningcontrole die Sparkle of Squirrel doet valt hier toch weg. Wat overblijft
/// is: het manifest komt over HTTPS van een adres dat ZUID beheert, en de zip moet exact de hash
/// hebben die daarin staat. Dat is de integriteit die we hier kunnen bieden, en dat zeg ik er ook bij.
enum Updater {
    static func check(feed: String, silent: Bool) async -> UpdateOutcome {
        guard !feed.isEmpty, let url = URL(string: feed) else { return .upToDate }
        do {
            var request = URLRequest(url: url)
            request.cachePolicy = .reloadIgnoringLocalCacheData
            request.timeoutInterval = 10
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                return .failed("het updateadres antwoordde niet")
            }
            let cast = try JSONDecoder().decode(Appcast.self, from: data)
            let current = Int(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0") ?? 0
            guard cast.version > current else { return .upToDate }

            if !(cast.mandatory ?? false), !silent {
                guard await ask(cast: cast) else { return .declined }
            }
            try await install(cast: cast)
            return .installed
        } catch {
            return .failed(error.localizedDescription)
        }
    }

    @MainActor
    private static func ask(cast: Appcast) -> Bool {
        let alert = NSAlert()
        alert.messageText = "Er is een nieuwe versie van NOTOS Bots"
        alert.informativeText = [
            "Versie \(cast.shortVersion) staat klaar.",
            cast.notes ?? "",
            "Bijwerken duurt een paar tellen; de app start daarna opnieuw op.",
        ].filter { !$0.isEmpty }.joined(separator: "\n\n")
        alert.addButton(withTitle: "Nu bijwerken")
        alert.addButton(withTitle: "Later")
        return alert.runModal() == .alertFirstButtonReturn
    }

    private static func install(cast: Appcast) async throws {
        guard let source = URL(string: cast.url) else {
            throw NSError(domain: "notos", code: 1, userInfo: [NSLocalizedDescriptionKey: "het adres van de nieuwe versie klopt niet"])
        }
        let (downloaded, _) = try await URLSession.shared.download(from: source)
        let digest = try SHA256.hash(data: Data(contentsOf: downloaded))
            .map { String(format: "%02x", $0) }.joined()
        guard digest.caseInsensitiveCompare(cast.sha256) == .orderedSame else {
            throw NSError(domain: "notos", code: 2, userInfo: [NSLocalizedDescriptionKey:
                "de gedownloade versie komt niet overeen met wat het manifest belooft, dus hij is niet geïnstalleerd"])
        }

        let staging = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("notos-bots-update-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: staging, withIntermediateDirectories: true)
        try run("/usr/bin/ditto", ["-x", "-k", downloaded.path, staging.path])

        let unpacked = try FileManager.default
            .contentsOfDirectory(at: staging, includingPropertiesForKeys: nil)
            .first { $0.pathExtension == "app" }
        guard let unpacked else {
            throw NSError(domain: "notos", code: 3, userInfo: [NSLocalizedDescriptionKey: "in het pakket zat geen app"])
        }

        // Quarantaine eraf: de zip komt van internet, en zonder dit weigert macOS de nieuwe app te
        // openen ook al draaide de oude al. Dit vervangt geen notarisatie; het maakt alleen de
        // update net zo vertrouwd als de installatie die de gebruiker zelf al goedkeurde.
        _ = try? run("/usr/bin/xattr", ["-dr", "com.apple.quarantine", unpacked.path])

        let current = Bundle.main.bundleURL
        let backup = staging.appendingPathComponent("previous.app")
        try? FileManager.default.moveItem(at: current, to: backup)
        do {
            try FileManager.default.moveItem(at: unpacked, to: current)
        } catch {
            // Terugdraaien: liever de oude app terug dan geen app.
            try? FileManager.default.moveItem(at: backup, to: current)
            throw error
        }

        log("bijgewerkt naar \(cast.shortVersion) (\(cast.version))")
        try run("/usr/bin/open", ["-n", current.path])
        await MainActor.run { NSApp.terminate(nil) }
    }

    @discardableResult
    private static func run(_ path: String, _ arguments: [String]) throws -> String {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: path)
        task.arguments = arguments
        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = pipe
        try task.run()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        task.waitUntilExit()
        let output = String(data: data, encoding: .utf8) ?? ""
        if task.terminationStatus != 0 {
            throw NSError(domain: "notos", code: Int(task.terminationStatus),
                          userInfo: [NSLocalizedDescriptionKey: output])
        }
        return output
    }
}

// MARK: - Het venster

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var status: NSTextField!
    private var settings = Settings.load()
    private var server: LocalServer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildWindow()
        buildMenu()
        Task { await startUp() }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ notification: Notification) {
        server?.stop()
    }

    // MARK: Opbouw

    private func buildWindow() {
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered, defer: false)
        window.title = "NOTOS Bots"
        window.titlebarAppearsTransparent = true
        window.setFrameAutosaveName("NotosBotsWindow")
        window.minSize = NSSize(width: 900, height: 600)

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        // Zonder dit meldt de app zich als Safari-webview en klagen sommige inlogschermen.
        webView.customUserAgent =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15 NOTOSBots/\(shortVersion)"
        webView.autoresizingMask = [.width, .height]

        status = NSTextField(labelWithString: "")
        status.alignment = .center
        status.textColor = .secondaryLabelColor
        status.font = .systemFont(ofSize: 13)
        status.autoresizingMask = [.width, .minYMargin, .maxYMargin]

        let content = NSView(frame: window.contentLayoutRect)
        content.autoresizingMask = [.width, .height]
        webView.frame = content.bounds
        status.frame = NSRect(x: 0, y: content.bounds.midY, width: content.bounds.width, height: 24)
        content.addSubview(webView)
        content.addSubview(status)
        window.contentView = content
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private var shortVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0"
    }

    private func buildMenu() {
        let main = NSMenu()

        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Over NOTOS Bots", action: #selector(showAbout), keyEquivalent: "")
        appMenu.addItem(withTitle: "Controleer op updates…", action: #selector(checkUpdatesNow), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Toon logboek", action: #selector(revealLog), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Verberg NOTOS Bots", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Stop NOTOS Bots", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        main.addItem(appItem)

        let viewItem = NSMenuItem()
        let viewMenu = NSMenu(title: "Weergave")
        viewMenu.addItem(withTitle: "Opnieuw laden", action: #selector(reload), keyEquivalent: "r")
        viewMenu.addItem(.separator())
        let sharedItem = NSMenuItem(title: "Gedeeld (notos.zuid.com)", action: #selector(useShared), keyEquivalent: "")
        sharedItem.state = settings.mode == .shared ? .on : .off
        sharedItem.tag = 1
        let localItem = NSMenuItem(title: "Lokaal op deze Mac", action: #selector(useLocal), keyEquivalent: "")
        localItem.state = settings.mode == .local ? .on : .off
        localItem.tag = 2
        viewMenu.addItem(sharedItem)
        viewMenu.addItem(localItem)
        viewItem.submenu = viewMenu
        main.addItem(viewItem)

        let editItem = NSMenuItem()
        let editMenu = NSMenu(title: "Bewerken")
        editMenu.addItem(withTitle: "Ongedaan maken", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Opnieuw", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Knippen", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Kopiëren", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Plakken", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Selecteer alles", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = editMenu
        main.addItem(editItem)

        NSApp.mainMenu = main
    }

    private func syncMenuState() {
        guard let view = NSApp.mainMenu?.item(withTitle: "")?.submenu else { return }
        _ = view
    }

    // MARK: Starten

    private func startUp() async {
        if !settings.explained {
            await MainActor.run { explainModes() }
            settings.explained = true
            settings.save()
        }
        if settings.checkForUpdates {
            let outcome = await Updater.check(feed: settings.updateFeed, silent: false)
            if case .installed = outcome { return }
            if case .failed(let reason) = outcome { log("update-check mislukt: \(reason)") }
        }
        await open(mode: settings.mode)
    }

    private func open(mode: Mode) async {
        switch mode {
        case .shared:
            server?.stop()
            server = nil
            await MainActor.run {
                show(status: "Verbinden met notos.zuid.com…")
                if let url = URL(string: settings.sharedURL) {
                    webView.load(URLRequest(url: url))
                }
            }
        case .local:
            await MainActor.run { show(status: "De server op deze Mac starten…") }
            let local = LocalServer(port: settings.localPort)
            server = local
            do {
                try local.start()
            } catch {
                await MainActor.run {
                    show(status: "De server kon niet starten. Kijk in het logboek onder het NOTOS Bots-menu.")
                }
                log("lokale server startte niet: \(error.localizedDescription)")
                return
            }
            let ready = await local.waitUntilReady()
            await MainActor.run {
                if ready {
                    show(status: "")
                    webView.load(URLRequest(url: URL(string: "http://127.0.0.1:\(settings.localPort)/")!))
                } else {
                    show(status: "De server op deze Mac reageerde niet. Kijk in het logboek onder het NOTOS Bots-menu.")
                }
            }
        }
    }

    /// Eén keer, bij de eerste start: wat de twee standen betekenen.
    ///
    /// De keuze is niet cosmetisch. Lokaal is deze Mac alleen; gedeeld is het team. Iemand die dat
    /// pas ontdekt nadat hij een campagne heeft opgezet die niemand ziet, heeft werk voor niets
    /// gedaan.
    @MainActor
    private func explainModes() {
        let alert = NSAlert()
        alert.messageText = "Twee standen, één app"
        alert.informativeText = """
        NOTOS Bots draait nu op deze Mac. Alles staat lokaal: je hebt geen internet nodig, maar je \
        deelt je workspaces, campagnes en goedkeuringen ook met niemand.

        Wil je met het team in dezelfde NOTOS werken, kies dan Weergave, Gedeeld. Je logt dan in \
        met je ZUID-account en ziet hetzelfde als je collega's.

        Je kunt op elk moment wisselen; wat je in de ene stand deed blijft in die stand staan.
        """
        alert.addButton(withTitle: "Duidelijk")
        alert.runModal()
    }

    @MainActor
    private func show(status text: String) {
        status.stringValue = text
        status.isHidden = text.isEmpty
        webView.isHidden = !text.isEmpty
    }

    // MARK: Menu-acties

    @objc private func reload() { webView.reload() }

    @objc private func useShared() {
        settings.mode = .shared
        settings.save()
        rebuildMenuState()
        Task { await open(mode: .shared) }
    }

    @objc private func useLocal() {
        let alert = NSAlert()
        alert.messageText = "Lokaal draaien op deze Mac"
        alert.informativeText = """
        In deze stand draait de hele NOTOS Bots op jouw Mac, met een database die alleen van jou is.

        Dat betekent dat je workspaces, campagnes, kanalen en goedkeuringen niet deelt met de rest \
        van het team: wat jij hier doet, ziet niemand anders. Gebruik dit om iets uit te proberen \
        of om door te werken zonder internet.
        """
        alert.addButton(withTitle: "Lokaal draaien")
        alert.addButton(withTitle: "Annuleren")
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        settings.mode = .local
        settings.save()
        rebuildMenuState()
        Task { await open(mode: .local) }
    }

    private func rebuildMenuState() {
        guard let menus = NSApp.mainMenu?.items else { return }
        for item in menus {
            guard let submenu = item.submenu else { continue }
            for entry in submenu.items where entry.tag == 1 || entry.tag == 2 {
                entry.state = (entry.tag == 1 && settings.mode == .shared)
                    || (entry.tag == 2 && settings.mode == .local) ? .on : .off
            }
        }
    }

    @objc private func checkUpdatesNow() {
        Task {
            let outcome = await Updater.check(feed: settings.updateFeed, silent: false)
            await MainActor.run {
                let alert = NSAlert()
                switch outcome {
                case .upToDate:
                    alert.messageText = "Je hebt de nieuwste versie"
                    alert.informativeText = "Versie \(self.shortVersion)."
                case .declined, .installed:
                    return
                case .failed(let reason):
                    alert.messageText = "Kon niet kijken of er een nieuwe versie is"
                    alert.informativeText = reason
                }
                alert.runModal()
            }
        }
    }

    @objc private func revealLog() {
        NSWorkspace.shared.activateFileViewerSelecting([Paths.logFile])
    }

    @objc private func showAbout() {
        let alert = NSAlert()
        alert.messageText = "NOTOS Bots \(shortVersion)"
        alert.informativeText = """
        \(settings.mode == .shared ? "Verbonden met \(settings.sharedURL)" : "Draait op deze Mac, poort \(settings.localPort)")

        Deze app is niet ondertekend met een Apple-certificaat. Updates komen over HTTPS van een \
        adres van ZUID en worden gecontroleerd tegen de hash in het manifest.
        """
        alert.runModal()
    }

    // MARK: Webview

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        log("laden mislukt: \(error.localizedDescription)")
        show(status: settings.mode == .shared
            ? "Geen verbinding met notos.zuid.com. Zit je op het netwerk?"
            : "De server op deze Mac antwoordde niet.")
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        show(status: "")
    }

    /// Een link die de app niet zelf hoort te tonen (een leverancier, een OAuth-scherm dat een
    /// nieuw venster wil) gaat naar de gewone browser.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView?
    {
        if let url = navigationAction.request.url { NSWorkspace.shared.open(url) }
        return nil
    }
}

let delegate = AppDelegate()
let application = NSApplication.shared
application.setActivationPolicy(.regular)
application.delegate = delegate
application.run()
