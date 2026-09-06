// NOTOS i18n: settings (nl). Keys: "settings.<file>.<name>". Add keys in both languages.
const settings: Record<string, string> = {
  "settings.componentsGallery.description":
    "De onderdelen die een Bot in een gesprek kan tekenen in plaats van iets in tekst te beschrijven. Welke daarvan een Bot mag gebruiken, bepaalt een beheerder.",
  "settings.componentsGallery.emptyDescription":
    "Zodra een beheerder een component publiceert, verschijnt die hier.",
  "settings.componentsGallery.emptyTitle": "Nog niets gepubliceerd",
  "settings.componentsGallery.loadFailed":
    "De componenten konden niet worden geladen.",
  "settings.componentsGallery.title": "Componentengalerij",
  "settings.componentsGalleryDetail.backLabel": "Componentengalerij",
  "settings.componentsGalleryDetail.backToGallery": "Terug naar de galerij",
  "settings.componentsGalleryDetail.calledAs": "Aangeroepen als",
  "settings.componentsGalleryDetail.details": "Details",
  "settings.componentsGalleryDetail.kind": "Soort",
  "settings.componentsGalleryDetail.loadFailed":
    "De componenten konden niet worden geladen.",
  "settings.componentsGalleryDetail.noSuchDescription":
    "Niets hier luistert naar die naam.",
  "settings.componentsGalleryDetail.noSuchTitle": "Geen component met die naam",
  "settings.componentsGalleryDetail.withdrawn":
    "Misschien is het ingetrokken, of levert deze deployment het niet meer mee.",
  "settings.connectedAccount.accessDescription":
    "Waar je mee akkoord ging, zoals de leverancier het heeft vastgelegd, niet wat er is gevraagd. Die twee verschillen als een toestemmingsscherm maar deels is geaccepteerd.",
  "settings.connectedAccount.accessTitle": "Toegang",
  "settings.connectedAccount.account": "Account",
  "settings.connectedAccount.backLabel": "Gekoppelde accounts",
  "settings.connectedAccount.connect": "Koppelen",
  "settings.connectedAccount.connected": "Gekoppeld",
  "settings.connectedAccount.disconnect": "Je {title}-account ontkoppelen",
  "settings.connectedAccount.disconnectNotice":
    "Ontkoppelen is nog niet gebouwd. Tot die tijd trek je de toegang in bij je {vendor}-account, onder de instellingen voor toegang door derden: daarmee stopt deze deployment direct met lezen.",
  "settings.connectedAccount.granted": "Toegekend",
  "settings.connectedAccount.noScope": "De leverancier gaf geen scope op.",
  "settings.connectedAccount.nobodyReads":
    "Geen enkele Bot kan dit als jou lezen. Bij het koppelen ga je naar de leverancier om toestemming te geven.",
  "settings.connectedAccount.notEnabled":
    "Een beheerder heeft deze connector nog niet ingeschakeld, dus er is nog niets om aan te koppelen.",
  "settings.connectedAccount.notYoursDescription":
    "Dit is geen dienst die je zelf koppelt.",
  "settings.connectedAccount.readsAsYou":
    "Een Bot die deze tools heeft gekregen leest dit als jou, en ziet alleen wat jij kunt zien.",
  "settings.connectedAccount.sharedCredential":
    "Een Bot bereikt deze met toegangsgegevens van de deployment, dezelfde voor iedereen.",
  "settings.connectedAccount.unknown":
    "Deze deployment heeft geen connector met die naam.",
  "settings.connectedAccount.yourAccount": "Je account",
  "settings.connectedAccounts.connectFailed":
    "Dat account kon niet worden gekoppeld. Er is niets opgeslagen, probeer het opnieuw.",
  "settings.connectedAccounts.connected": "Gekoppeld",
  "settings.connectedAccounts.description":
    "Diensten die een Bot als jou leest, zodat hij alleen ziet wat jij kunt zien. Koppelen doe je zelf, en niemand kan dat voor je doen.",
  "settings.connectedAccounts.empty":
    "Nog niets om te koppelen. Dit verschijnt zodra een beheerder een connector inschakelt die leest als de persoon die het vraagt.",
  "settings.connectedAccounts.loadFailed":
    "Je gekoppelde accounts konden niet worden geladen.",
  "settings.connectedAccounts.notConnected": "Niet gekoppeld",
  "settings.connectedAccounts.title": "Gekoppelde accounts",
  "settings.home.noWorkspace":
    "Je hebt nog geen workspace. Vraag ZUID om je toe te voegen bij een klant in NOTOS onder Instellingen › Toegang.",
  "settings.index.darkTheme": "Donker thema",
  "settings.index.darkThemeDescription":
    "Gebruik de donkere weergave in heel Bots.",
  "settings.index.description":
    "Hoe Bots er voor jou uitziet en zich gedraagt. Dit geldt alleen voor jouw account, op elke deployment waar je inlogt.",
  "settings.index.general": "Algemeen",
  "settings.index.shortcuts": "Sneltoetsen",
  "settings.index.title": "Voorkeuren",
  "settings.modelKeysPanel.addKey": "Sleutel toevoegen",
  "settings.modelKeysPanel.apiKeyLabel": "{provider} API-sleutel",
  "settings.modelKeysPanel.close": "Sluiten",
  "settings.modelKeysPanel.getOneAt": "Haal er een op bij",
  "settings.modelKeysPanel.keySet": "Sleutel {hint} · ingesteld op {date}",
  "settings.modelKeysPanel.keySetWithLabel":
    "Sleutel {hint} · {label} · ingesteld op {date}",
  "settings.modelKeysPanel.label": "Label",
  "settings.modelKeysPanel.labelPlaceholder": "Label (optioneel)",
  "settings.modelKeysPanel.loadFailed":
    "De sleutels konden niet worden geladen.",
  "settings.modelKeysPanel.noKey": "Nog geen sleutel",
  "settings.modelKeysPanel.off": "Uit",
  "settings.modelKeysPanel.ready": "Klaar",
  "settings.modelKeysPanel.remove": "Verwijderen",
  "settings.modelKeysPanel.replace": "Vervangen",
  "settings.modelKeysPanel.save": "Opslaan",
  "settings.modelKeysPanel.startsWith": "Die begint met {prefix}",
  "settings.modelPicker.heading": "Model voor dit gesprek",
  "settings.modelPicker.keyedHint":
    "Claude, GPT en OpenRouter verschijnen hier zodra er een sleutel is ingesteld onder Modellen.",
  "settings.modelPicker.model": "Model",
  "settings.modelPicker.triggerLabel": "Model voor dit gesprek: {label}",
  "settings.modelPicker.workspaceModel": "Model van de workspace",
  "settings.models.anotherModel": "Een ander model (typ het id)…",
  "settings.models.custom": "Eigen keuze: {provider} · {model}",
  "settings.models.description":
    "Je persoonlijke ruimte draait op het model dat je hier kiest, met je eigen sleutels. Niemand anders ziet je ruimte, en je sleutels gelden alleen voor je ruimte.",
  "settings.models.keysExplanation":
    "Een abonnement is geen sleutel: Claude Max en Gemini CLI loggen je in op je eigen laptop en zijn niet bruikbaar vanaf een server. Bots draaien op API-toegang, die de aanbieder per gebruik in rekening brengt. Zonder eigen sleutel gebruikt je ruimte de sleutels van de deployment, voor zover een beheerder die heeft ingesteld.",
  "settings.models.loadFailed": "Je modelkeuze kon niet worden geladen.",
  "settings.models.modelId": "Model-id",
  "settings.models.modelIdPlaceholder":
    "bv. anthropic/claude-sonnet-5 op OpenRouter",
  "settings.models.provider": "Aanbieder",
  "settings.models.runsOn": "Je persoonlijke ruimte draait op",
  "settings.models.save": "Opslaan",
  "settings.models.selectLabel": "Model voor je persoonlijke ruimte",
  "settings.models.title": "Modellen",
  "settings.models.yourKeys": "Je sleutels",
  "settings.onboarding.back": "Terug",
  "settings.onboarding.composerExample":
    "Geef taken uit handen aan je team van Bots",
  "settings.onboarding.computerTitle": "Elke Bot heeft een eigen computer",
  "settings.onboarding.continue": "Doorgaan",
  "settings.onboarding.example": "Voorbeeld",
  "settings.onboarding.getStarted": "Aan de slag",
  "settings.onboarding.placeholderData": "Data-analist",
  "settings.onboarding.placeholderResearch": "Onderzoeksanalist",
  "settings.onboarding.placeholderSupport": "Helpdesk-Bot",
  "settings.onboarding.rosterTitle":
    "Kies uit verschillende Bots of maak er zelf een",
  "settings.onboarding.saving": "Opslaan…",
  "settings.onboarding.welcomeTitle": "Welkom bij {product}",
  "settings.onboarding.yourOwn": "Je eigen Bot",
  "settings.settingsSidebar.backToApp": "Terug naar de app",
  "settings.settingsSidebar.componentsGallery": "Componentengalerij",
  "settings.settingsSidebar.connectedAccounts": "Gekoppelde accounts",
  "settings.settingsSidebar.general": "Algemeen",
  "settings.settingsSidebar.models": "Modellen",
  "settings.sign.button": "Inloggen bij NOTOS",
  "settings.sign.explanation":
    "Je logt in bij NOTOS. Zodra je daar bent ingelogd, werkt dit vanzelf.",
  "settings.sign.local":
    "Lokaal: log in op notos.zuid.com in dezelfde browser en herlaad deze pagina.",
};

export default settings;
