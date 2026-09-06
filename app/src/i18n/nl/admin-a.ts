// NOTOS i18n: admin-a (nl). Keys: "admin-a.<file>.<name>". Add keys in both languages.
const adminUa: Record<string, string> = {
  "admin-a.admin-sidebar.auditDescription":
    "Elke actie in deze omgeving, en door wie.",
  "admin-a.admin-sidebar.auditTitle": "Audit",
  "admin-a.admin-sidebar.backToApp": "Terug naar de app",
  "admin-a.admin-sidebar.boundariesDescription":
    "Regels die bepalen wat een Bot nooit mag doen.",
  "admin-a.admin-sidebar.boundariesTitle": "Grenzen",
  "admin-a.admin-sidebar.componentsDescription":
    "Eigen componenten die een Bot in een gesprek kan tekenen.",
  "admin-a.admin-sidebar.componentsTitle": "UI-componenten",
  "admin-a.admin-sidebar.computersDescription":
    "De machines waarop Bots hun tools draaien.",
  "admin-a.admin-sidebar.computersTitle": "Computers",
  "admin-a.admin-sidebar.credentialsDescription":
    "Sleutels en tokens die voor deze omgeving bewaard worden.",
  "admin-a.admin-sidebar.credentialsTitle": "Toegangsgegevens",
  "admin-a.admin-sidebar.groupAccessLabel": "Wie er binnen mag",
  "admin-a.admin-sidebar.groupDoDescription":
    "Mogelijkheden en interface-onderdelen die voor alle Bots beschikbaar zijn.",
  "admin-a.admin-sidebar.groupDoLabel": "Wat Bots kunnen doen",
  "admin-a.admin-sidebar.groupHappenedLabel": "Wat er gebeurd is",
  "admin-a.admin-sidebar.groupReachDescription":
    "Alles wat een Bot buiten deze app kan aanraken, en de grenzen daaraan.",
  "admin-a.admin-sidebar.groupReachLabel": "Waar Bots bij kunnen",
  "admin-a.admin-sidebar.modelsDescription":
    "API-sleutels voor de modelaanbieders die er een nodig hebben; Gemini op Vertex heeft er geen nodig.",
  "admin-a.admin-sidebar.modelsTitle": "Modellen",
  "admin-a.admin-sidebar.overview": "Overzicht",
  "admin-a.admin-sidebar.peopleDescription":
    "Iedereen die is ingelogd, wie deze omgeving beheert, en wiens toegang is ingetrokken.",
  "admin-a.admin-sidebar.peopleTitle": "Mensen",
  "admin-a.admin-sidebar.playgroundDescription":
    "Schrijf een component en zie het verschijnen terwijl je typt.",
  "admin-a.admin-sidebar.playgroundTitle": "Speeltuin",
  "admin-a.admin-sidebar.pluginsDescription":
    "De diensten waar deze omgeving bij kan, en welke Bots dat mogen.",
  "admin-a.admin-sidebar.pluginsTitle": "Plugins",
  "admin-a.admin-sidebar.skillsDescription":
    "Benoemde instructies die iedereen met een schuine streep kan aanroepen.",
  "admin-a.admin-sidebar.skillsTitle": "Skills",
  "admin-a.admin-sidebar.workspacesDescription":
    "Elke NOTOS-klant, het model waarop die draait, de Drive-mappen en wie erin zit.",
  "admin-a.admin-sidebar.workspacesTitle": "Workspaces",
  "admin-a.audit.allowed": "Toegestaan",
  "admin-a.audit.blocked": "Geblokkeerd",
  "admin-a.audit.colBot": "Bot",
  "admin-a.audit.colDecision": "Besluit",
  "admin-a.audit.colOn": "Waarop",
  "admin-a.audit.colWhat": "Wat",
  "admin-a.audit.colWhen": "Wanneer",
  "admin-a.audit.decisionApprovalDenied": "Afgewezen door een persoon",
  "admin-a.audit.decisionApprovalGranted": "Goedgekeurd door een persoon",
  "admin-a.audit.decisionApprovalRequested": "Wacht op een persoon",
  "admin-a.audit.decisionBotDeclined": "De Bot weigerde",
  "admin-a.audit.decisionCallFailed": "De server antwoordde niet",
  "admin-a.audit.decisionCallSucceeded": "Aangeroepen namens deze Bot",
  "admin-a.audit.decisionCallbackRefused":
    "Kon niet bewijzen welke Bot het was",
  "admin-a.audit.decisionComponentGranted": "Toegekend aan deze Bot",
  "admin-a.audit.decisionComponentPublished":
    "Gepubliceerd, dus elke Bot mag het gebruiken",
  "admin-a.audit.decisionComponentRevoked": "Afgenomen van deze Bot",
  "admin-a.audit.decisionComponentUnpublished":
    "Publicatie ingetrokken, dus geen Bot mag het gebruiken",
  "admin-a.audit.decisionConfigurationChanged": "Configuratie gewijzigd",
  "admin-a.audit.decisionControlReleased": "Het stuur is teruggegeven",
  "admin-a.audit.decisionControlTaken": "Een persoon nam het stuur over",
  "admin-a.audit.decisionCredentialCreated": "Toegangsgegeven opgeslagen",
  "admin-a.audit.decisionDraftSaved":
    "Concept opgeslagen, nog niet gepubliceerd",
  "admin-a.audit.decisionFunctionCalled": "Echte data gelezen",
  "admin-a.audit.decisionFunctionFailed": "Kon niet gelezen worden",
  "admin-a.audit.decisionFunctionGranted": "Mag dit lezen",
  "admin-a.audit.decisionFunctionRevoked": "Mag dit niet meer lezen",
  "admin-a.audit.decisionHelpRequested": "De Bot vroeg om hulp",
  "admin-a.audit.decisionIsolationLoaded": "Isolatie bij opstarten",
  "admin-a.audit.decisionPolicyLoaded": "Grens bij opstarten",
  "admin-a.audit.decisionRefused": "Geweigerd",
  "admin-a.audit.decisionReset": "De computer is gereset",
  "admin-a.audit.decisionSecretRequested": "De Bot vroeg om een geheim",
  "admin-a.audit.decisionSecretSupplied": "Een persoon gaf een geheim",
  "admin-a.audit.decisionStopped": "Een persoon drukte op stop",
  "admin-a.audit.decisionStreamStalled": "De Bot reageerde niet meer",
  "admin-a.audit.decisionToolsDiscovered": "Tools aangeboden voor één run",
  "admin-a.audit.description":
    "Elke actie die een Bot deed, en elke actie die het beleid van deze omgeving weigerde.",
  "admin-a.audit.didNotHappen": "Niet gebeurd",
  "admin-a.audit.discoveryNothingChosen":
    "Geen skill van toepassing, dus alles is aangeboden",
  "admin-a.audit.discoveryNothingDeclared":
    "Geen enkele skill noemt een van deze tools",
  "admin-a.audit.discoverySelected": "Gekozen door een skill",
  "admin-a.audit.discoveryUnavailable":
    "Kon niet kiezen, dus alles is aangeboden",
  "admin-a.audit.discoveryUnderFloor":
    "Weinig genoeg tools om ze allemaal aan te bieden",
  "admin-a.audit.dryRunNote": "proefdraaien: vastgelegd, niet afgedwongen",
  "admin-a.audit.empty": "Nog geen gebeurtenissen voor dit filter.",
  "admin-a.audit.filterApprovals": "Goedkeuringen",
  "admin-a.audit.filterComputerActions": "Computeracties",
  "admin-a.audit.filterEverything": "Alles",
  "admin-a.audit.filterNeedsApproval": "Wacht op goedkeuring",
  "admin-a.audit.loadFailed": "Het auditspoor kon niet geladen worden.",
  "admin-a.audit.refresh": "Vernieuwen",
  "admin-a.audit.reportedByBot": ", gemeld door de Bot zelf",
  "admin-a.audit.routedByPerson": "De persoon koos deze Bot",
  "admin-a.audit.routedFallback": "Naar de standaard-Bot gestuurd",
  "admin-a.audit.routedMatched": "Naar de Bot gestuurd waarvoor het bedoeld is",
  "admin-a.audit.title": "Audit",
  "admin-a.audit.toolsOffered": "{offered} van {granted} tools",
  "admin-a.bot-grant-picker.countOne": "{held} van {total} Bot",
  "admin-a.bot-grant-picker.countOther": "{held} van {total} Bots",
  "admin-a.bot-grant-picker.groupCount": "{held} van {total}",
  "admin-a.bot-grant-picker.noMatch": "Geen Bot komt overeen met “{query}”.",
  "admin-a.bot-grant-picker.noWorkspace": "Geen workspace",
  "admin-a.bot-grant-picker.searchAria": "Bots zoeken",
  "admin-a.bot-grant-picker.searchPlaceholder": "Bots zoeken…",
  "admin-a.boundaries.addRule": "Regel toevoegen",
  "admin-a.boundaries.allowDescription":
    "De ondergrens, toegepast op alles wat de weigerlijst niet ving. Geen formaliteit: een lege lijst hier staat niets toe, dus een omgeving die dit leegmaakt weigert elke actie in plaats van elke actie toe te staan.",
  "admin-a.boundaries.allowTitle": "Verder mag het",
  "admin-a.boundaries.allowTrue": "true, alles wat hierboven niet geweigerd is",
  "admin-a.boundaries.auditLink": "Audit",
  "admin-a.boundaries.computersOff":
    "Computers staan uit in deze omgeving, dus hier valt niets te begrenzen.",
  "admin-a.boundaries.denyDescription":
    "Wordt als eerste gecheckt, en een treffer beslist: niets hieronder wordt nog bekeken en de Bot hoort welke regel hem weigerde. Regels zijn CEL en kunnen vragen naar `tool.name`, `intent`, `bot.id`, `actor.id`, `page.url` en `page.host`, het element waarop gehandeld wordt, de `key` die wordt ingedrukt, het bestand dat wordt aangeraakt, het `command` dat wordt uitgevoerd, en `mcp.server`, `mcp.tool` en `mcp.effect` voor een aanroep van andermans tools. Een regel die niet te evalueren is telt als treffer, dus een verkeerd getypte deny weigert liever dan stilletjes toe te staan wat hij moest verbieden.",
  "admin-a.boundaries.denyTitle": "Dit mag nooit",
  "admin-a.boundaries.descriptionAfter": "met de regel die hem weigerde.",
  "admin-a.boundaries.descriptionBefore":
    "Wat elke Bot wel en niet met zijn computer mag. Regels worden bij elke actie gecheckt voordat die gebeurt, en een weigering wordt vastgelegd in",
  "admin-a.boundaries.modeDescription":
    "Stoppen stopt de actie. Vastleggen en toestaan schrijft dezelfde rij weg en laat de actie door; zo probeer je een regel uit op echt verkeer voordat hij iemand gaat weigeren.",
  "admin-a.boundaries.modeDryRun": "Leg vast en sta toe",
  "admin-a.boundaries.modeDryRunNote":
    "Er wordt niets gestopt. Elke actie waarop een regel van toepassing is wordt vastgelegd alsof die geweigerd was; zo probeer je een regel uit voordat je hem aanzet.",
  "admin-a.boundaries.modeEnforce": "Stop de actie",
  "admin-a.boundaries.modeEnforceNote":
    "De Bot wordt gestopt en hoort welke regel hem weigerde.",
  "admin-a.boundaries.modeTitle": "Als een regel van toepassing is",
  "admin-a.boundaries.noActions":
    "Nog geen vastgelegde computeracties om tegen te testen. De regel is geldig; waarop hij van toepassing is weet je pas als Bots iets gedaan hebben.",
  "admin-a.boundaries.noRules":
    "Geen regels. Elke actie wordt toegestaan en vastgelegd.",
  "admin-a.boundaries.onElement": "op “{name}”",
  "admin-a.boundaries.presetNoPasswordCost":
    "Een wachtwoordveld dat de pagina anders noemt valt er niet onder; de regel kijkt naar het label.",
  "admin-a.boundaries.presetNoPasswordLabel":
    "Nooit in een wachtwoordveld typen",
  "admin-a.boundaries.presetNoSocialCost":
    "Alleen de twee genoemde hosts. Een link die ergens anders vandaan daarheen doorstuurt is toegestaan.",
  "admin-a.boundaries.presetNoSocialLabel": "Blijf van social media af",
  "admin-a.boundaries.presetNoSubmitCost":
    "Houdt de Bot ook tegen om Enter voor iets anders in te drukken, want een formulier verstuurt vanuit elk veld met Enter.",
  "admin-a.boundaries.presetNoSubmitLabel": "Nooit een formulier versturen",
  "admin-a.boundaries.remove": "Verwijderen",
  "admin-a.boundaries.ruleAriaLabel": "Een regel, geschreven in CEL",
  "admin-a.boundaries.running": "met commando",
  "admin-a.boundaries.saved":
    "Opgeslagen. Het geldt voor de volgende actie van elke Bot.",
  "admin-a.boundaries.showingFirst":
    "De eerste {count} worden getoond; het aantal hierboven gaat over alles wat gescand is.",
  "admin-a.boundaries.testFirst": "Eerst testen",
  "admin-a.boundaries.testedNone":
    "Getest tegen de laatste {scanned} vastgelegde acties: deze regel zou er geen van geweigerd hebben. Hij kan nog wel op toekomstige acties van toepassing zijn.",
  "admin-a.boundaries.testedSome":
    "Getest tegen de laatste {scanned} vastgelegde acties: deze regel zou er {wouldRefuse} geweigerd hebben.",
  "admin-a.boundaries.testing": "Testen…",
  "admin-a.boundaries.title": "Grenzen",
  "admin-a.boundaries.touching": "op bestand {file}",
  "admin-a.boundaries.unsavedNote":
    "Wijzigingen gelden voor de volgende actie van elke Bot en blijven bewaard: na een herstart geldt weer wat hier staat.",
  "admin-a.boundaries.workspacesDescription":
    "Elke workspace begint met één regel: een tool die iets verandert wacht op een persoon. De Bot vraagt, de persoon antwoordt op een kaart in het kanaal, en dezelfde aanroep gaat één keer door. Lezen wacht nooit.",
  "admin-a.boundaries.workspacesTitle": "Workspaces",
  "admin-a.boundaries.wouldAllow": "Zou nu toestaan",
  "admin-a.boundaries.wouldRefuse": "Zou weigeren",
  "admin-a.computers.auditLink": "Audit",
  "admin-a.computers.cancel": "Annuleren",
  "admin-a.computers.description":
    "De browser van elke Bot en het profiel dat die bewaart. Door het profiel is een Bot morgen nog ingelogd, en een reset logt hem overal uit.",
  "admin-a.computers.egressDirect": "Gaat rechtstreeks naar buiten",
  "admin-a.computers.egressUnknown": "Uitgaand verkeer niet gemeld",
  "admin-a.computers.egressVia": "Gaat naar buiten via {egress}",
  "admin-a.computers.empty":
    "Nog geen computers. Er verschijnt er een zodra een Bot voor het eerst een pagina opent.",
  "admin-a.computers.helpAfter": ".",
  "admin-a.computers.helpReset": "Resetten",
  "admin-a.computers.helpResetText":
    "verwijdert het profiel, dus de Bot wordt overal uitgelogd en begint schoon. Beide worden vastgelegd in",
  "admin-a.computers.helpStop": "Stoppen",
  "admin-a.computers.helpStopText":
    "sluit de browser en bewaart de logins: bij de volgende actie van de Bot start hij weer waar hij gebleven was.",
  "admin-a.computers.listFailed": "De computers konden niet opgehaald worden.",
  "admin-a.computers.notRunning":
    "Geen browser actief. Die start zodra de Bot hem weer nodig heeft.",
  "admin-a.computers.off": "Computers staan uit in deze omgeving.",
  "admin-a.computers.perBot":
    "Elke Bot heeft een eigen computer: een eigen container, eigen bestanden en een eigen browserprofiel.",
  "admin-a.computers.reset": "Resetten",
  "admin-a.computers.resetDescription":
    "Het profiel wordt verwijderd, dus de Bot wordt uitgelogd bij elke dienst waar hij was ingelogd en begint schoon. Dit is niet terug te draaien.",
  "admin-a.computers.resetIt": "Ja, resetten",
  "admin-a.computers.resetTitle": "De computer van {name} resetten?",
  "admin-a.computers.resetting": "Resetten…",
  "admin-a.computers.runningSince": "Browser draait sinds {time}",
  "admin-a.computers.sectionTitle": "Computers in deze omgeving",
  "admin-a.computers.sharedText":
    "Ze delen de logins, de bestanden en de sessie, dus een Bot kan bij waar een andere is ingelogd. Zet `COMPUTER_SUPERVISOR_URL` om elke Bot een eigen computer te geven.",
  "admin-a.computers.sharedTitle": "Alle Bots delen één computer.",
  "admin-a.computers.stopBrowser": "Browser stoppen",
  "admin-a.computers.title": "Computers",
  "admin-a.computers.working": "Bezig…",
  "admin-a.credentials.addCredential": "Toegangsgegeven toevoegen",
  "admin-a.credentials.cancel": "Annuleren",
  "admin-a.credentials.description":
    "Toegangsgegevens zijn alleen te schrijven. Bots toont de geheime waarden nooit.",
  "admin-a.credentials.dialogDescription":
    "Bewaard voor deze omgeving en na het opslaan nooit meer getoond.",
  "admin-a.credentials.keyIdLabel": "Sleutel-ID",
  "admin-a.credentials.keyIdPlaceholder": "productie",
  "admin-a.credentials.kindConnector": "Connector",
  "admin-a.credentials.kindLabel": "Type",
  "admin-a.credentials.kindModel": "Model",
  "admin-a.credentials.loadFailed":
    "Toegangsgegevens konden niet geladen worden.",
  "admin-a.credentials.none": "Er zijn geen toegangsgegevens ingesteld.",
  "admin-a.credentials.noneActive": "Geen actieve toegangsgegevens.",
  "admin-a.credentials.providerLabel": "Aanbieder",
  "admin-a.credentials.replaceWarning":
    "Deze sleutel heeft al een actief toegangsgegeven. Opslaan vervangt het, en het vervangen gegeven wordt ingetrokken.",
  "admin-a.credentials.revoke": "Intrekken",
  "admin-a.credentials.revoked": "ingetrokken",
  "admin-a.credentials.revokedCountOne": "{count} ingetrokken toegangsgegeven",
  "admin-a.credentials.revokedCountOther":
    "{count} ingetrokken toegangsgegevens",
  "admin-a.credentials.revokedOn": "ingetrokken op {date}",
  "admin-a.credentials.save": "Toegangsgegeven opslaan",
  "admin-a.credentials.saveFailed":
    "Het toegangsgegeven kon niet opgeslagen worden. Probeer het opnieuw.",
  "admin-a.credentials.saving": "Opslaan…",
  "admin-a.credentials.secretLabel": "Geheim",
  "admin-a.credentials.sectionTitle": "Ingestelde toegangsgegevens",
  "admin-a.credentials.title": "Toegangsgegevens",
  "admin-a.index.description":
    "Instellingen die voor iedereen in deze omgeving gelden. Alles hier raakt elke persoon en elke Bot, en dat is wat het onderscheidt van je eigen voorkeuren.",
  "admin-a.index.title": "Beheer",
  "admin-a.models.chooseModelAfter": " welk model elke workspace gebruikt.",
  "admin-a.models.chooseModelBefore": "Kies onder",
  "admin-a.models.description":
    "Gemini op Vertex AI draait op de eigen Google-toegangsgegevens van deze server en heeft geen sleutel nodig. Elke andere aanbieder heeft een API-sleutel nodig. Een workspace zonder eigen sleutel gebruikt de sleutels hier; kies het model per workspace onder Workspaces.",
  "admin-a.models.subscriptionNote":
    "Een abonnement is geen sleutel: Claude Max en Gemini CLI loggen een persoon in op de eigen laptop en zijn niet vanaf een server te gebruiken. Bots draaien hier op API-toegang, per gebruik gefactureerd door de aanbieder. Sleutels worden verzegeld met de encryptiesleutel van deze omgeving en nooit meer getoond; alleen de laatste vier tekens wel.",
  "admin-a.models.title": "Modellen",
  "admin-a.models.workspacesLink": "Workspaces",
  "admin-a.people.accessRemoved": "Toegang ingetrokken · {providers}",
  "admin-a.people.adminByConfig": "Beheerder via configuratie · {when}",
  "admin-a.people.description":
    "Iedereen die is ingelogd. Beheerders komen bij deze schermen; alle anderen praten met Bots.",
  "admin-a.people.empty":
    "Nog niemand is ingelogd. Mensen verschijnen hier zodra ze dat doen.",
  "admin-a.people.lastSignedIn": "laatst ingelogd op {date}",
  "admin-a.people.loadFailed": "Mensen konden niet geladen worden.",
  "admin-a.people.loading": "Laden…",
  "admin-a.people.neverSignedIn": "nooit ingelogd",
  "admin-a.people.noMatch": 'Niemand hier komt overeen met "{query}".',
  "admin-a.people.noProvider": "geen aanbieder",
  "admin-a.people.providerWhen": "{providers} · {when}",
  "admin-a.people.remove": "Verwijderen",
  "admin-a.people.restore": "Herstellen",
  "admin-a.people.searchAria": "Mensen zoeken",
  "admin-a.people.searchPlaceholder": "Zoek op naam of adres",
  "admin-a.people.sectionDescription":
    "Wie beheerder is wordt in NOTOS (Team) bepaald, niet hier. Verwijderen blokkeert een adres in Bots, ook als NOTOS het nog binnenlaat.",
  "admin-a.people.sectionTitle": "Wie er is",
  "admin-a.people.showMore": "Meer tonen",
  "admin-a.people.title": "Mensen",
  "admin-a.playground.argumentsLabel": "Argumenten (JSON Schema)",
  "admin-a.playground.cancel": "Annuleren",
  "admin-a.playground.delete": "Verwijderen",
  "admin-a.playground.deleteDescription":
    "Het wordt uit deze omgeving verwijderd. Elke Bot die het kon tekenen kan dat niet meer, en dit is niet terug te draaien.",
  "admin-a.playground.deleteIt": "Ja, verwijderen",
  "admin-a.playground.deleteTitle": "{name} verwijderen?",
  "admin-a.playground.description":
    "Schrijf hier een component en publiceer het zonder een nieuwe versie uit te rollen. Wat je bewerkt is een concept; een gesprek tekent alleen wat gepubliceerd is.",
  "admin-a.playground.descriptionLabel": "Wat het model erover te horen krijgt",
  "admin-a.playground.descriptionPlaceholder":
    "Toon een terugbetaling met bedrag, reden en status.",
  "admin-a.playground.draftOnly": "alleen concept, geen Bot kan het tekenen",
  "admin-a.playground.editedSince": " · bewerkt na publicatie",
  "admin-a.playground.invalidSample":
    "De voorbeeldargumenten zijn geen geldige JSON, dus er valt niets mee te tekenen.",
  "admin-a.playground.nameLabel": "Naam",
  "admin-a.playground.notValidJson": "geen geldige JSON",
  "admin-a.playground.nothingYet": "Nog niets.",
  "admin-a.playground.open": "Openen",
  "admin-a.playground.preview": "Voorbeeld",
  "admin-a.playground.publish": "Publiceren",
  "admin-a.playground.publishNote":
    "Publiceren maakt het beschikbaar voor elke Bot. Zet het voor een specifieke Bot uit op de pagina UI-componenten, net als bij een component dat met deze build meekomt.",
  "admin-a.playground.publishedRevision": "gepubliceerd, revisie {revision}",
  "admin-a.playground.sampleLabel": "Voorbeeldargumenten",
  "admin-a.playground.saveDraft": "Concept opslaan",
  "admin-a.playground.savedHere": "Hier opgeslagen",
  "admin-a.playground.title": "Speeltuin",
  "admin-a.playground.titleLabel": "Titel",
  "admin-a.playground.titlePlaceholder": "Terugbetalingskaart",
};

export default adminUa;
