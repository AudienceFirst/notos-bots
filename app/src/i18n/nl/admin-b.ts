// NOTOS i18n: admin-b (nl). Keys: "admin-b.<file>.<name>". Add keys in both languages.
const adminUb: Record<string, string> = {
  "admin-b.component.allBots": "Alle {count} Bots",
  "admin-b.component.availableTo": "Beschikbaar voor",
  "admin-b.component.back": "UI-componenten",
  "admin-b.component.backToComponents": "Terug naar componenten",
  "admin-b.component.by": "door {name}",
  "admin-b.component.calledAs": "Aangeroepen als",
  "admin-b.component.cancel": "Annuleren",
  "admin-b.component.configuration": "Configuratie",
  "admin-b.component.configurationDescription":
    "Waar dit component voor is, en welke Bots ermee mogen antwoorden.",
  "admin-b.component.descriptionDialogDescription":
    "Wat het model leest als het beslist dit aan te roepen. Het verandert niets tot het component gepubliceerd is.",
  "admin-b.component.descriptionLabel": "Beschrijving",
  "admin-b.component.details": "Details",
  "admin-b.component.done": "Klaar",
  "admin-b.component.errorTitle": "Componenten",
  "admin-b.component.functionsDialogDescription":
    "Een aparte toekenning naast Beschikbaar voor, en die volgt er niet uit: die bepaalt wie dit mag tekenen, en deze bepaalt wat het zelf mag ophalen om zichzelf te tekenen. Zolang geen van beide aan staat toont het component alleen wat de Bot meegeeft, en elke leesactie die het wel doet is een regel in Audit. Elke wijziging gaat meteen in.",
  "admin-b.component.grantsDialogDescription":
    "Zet een Bot uit en die hoort nooit dat dit component bestaat, dus hij kan er niet om vragen en verontschuldigt zich niet dat hij het niet heeft. Elke wijziging gaat meteen in.",
  "admin-b.component.kind": "Soort",
  "admin-b.component.lastChanged": "Laatst gewijzigd",
  "admin-b.component.loadFailed": "De componenten konden niet worden geladen.",
  "admin-b.component.mayRead": "Mag lezen",
  "admin-b.component.noBots": "Geen Bots",
  "admin-b.component.noBotsYet": "Er zijn nog geen Bots",
  "admin-b.component.noBotsYetSentence": "Er zijn nog geen Bots.",
  "admin-b.component.noDataFunctions":
    "Deze omgeving kent geen datafuncties toe",
  "admin-b.component.noDataFunctionsSentence":
    "Deze omgeving kent geen datafuncties toe.",
  "admin-b.component.noFunctionsHeld":
    "Niets: het tekent alleen wat het model aanreikt",
  "admin-b.component.notFoundDescription": "Niets hier luistert naar die naam.",
  "admin-b.component.notFoundHint":
    "Misschien is het hernoemd, of levert deze omgeving het niet meer mee.",
  "admin-b.component.notFoundTitle": "Component bestaat niet",
  "admin-b.component.notInBuild": "Niet in deze build",
  "admin-b.component.notInBuildDescription":
    "Niets hier kan het tekenen, wat er verder ook is ingesteld.",
  "admin-b.component.nothingPublished":
    "Er is niets gepubliceerd, dus geen Bot hoort hiervan.",
  "admin-b.component.nothingYet": "Nog niets",
  "admin-b.component.published": "Gepubliceerd",
  "admin-b.component.publishedOff": "Geen Bot mag het gebruiken.",
  "admin-b.component.publishedOn": "Bots mogen ermee antwoorden.",
  "admin-b.component.save": "Opslaan",
  "admin-b.component.someBots": "{granted} van {total} Bots",
  "admin-b.component.unpublishedChanges":
    "De beschrijving heeft wijzigingen die niet gepubliceerd zijn.",
  "admin-b.components.description":
    "Waar elke Bot mee mag antwoorden. Elk gepubliceerd component is beschikbaar voor elke Bot; zet er hier een uit en die Bot hoort er nooit van. Elke wijziging en elke weigering is een regel in Audit.",
  "admin-b.components.emptyDescription":
    "Componenten die je Bots kunnen gebruiken verschijnen hier.",
  "admin-b.components.emptyTitle": "Nog geen componenten",
  "admin-b.components.loadFailed": "De componenten konden niet worden geladen.",
  "admin-b.components.title": "UI-componenten",
  "admin-b.plugin.accessToken": "Toegangstoken",
  "admin-b.plugin.accessTokenDescription":
    "Wordt als bearer-token meegestuurd bij elke aanroep naar deze leverancier.",
  "admin-b.plugin.accessTokenDialogDescription":
    "Bewaard in de kluis van deze omgeving en nooit teruggelezen.",
  "admin-b.plugin.accessTokenFor": "Toegangstoken voor {title}",
  "admin-b.plugin.allBots": "Alle Bots",
  "admin-b.plugin.back": "Plugins",
  "admin-b.plugin.builtIn": "Ingebouwd",
  "admin-b.plugin.builtinDescription":
    "Niets in te stellen. Deze tools draaien binnen deze omgeving, op de tabellen die hij al heeft.",
  "admin-b.plugin.cancel": "Annuleren",
  "admin-b.plugin.changesThings": "verandert iets",
  "admin-b.plugin.changesThingsHeading": "Verandert iets",
  "admin-b.plugin.clientId": "Client-ID",
  "admin-b.plugin.clientSecret": "Client-geheim",
  "admin-b.plugin.connect": "Koppelen",
  "admin-b.plugin.connected": "Gekoppeld",
  "admin-b.plugin.connection": "Verbinding",
  "admin-b.plugin.connectionBearerDescription":
    "Wat deze omgeving aan de leverancier laat zien. Eén toegangsgegeven, gebruikt voor iedereen.",
  "admin-b.plugin.connectionBuiltinDescription":
    "Ingebouwd in deze omgeving. Er is geen leverancier om te bereiken en geen toegangsgegeven om te bewaren: een aanroep draait als degene die vroeg.",
  "admin-b.plugin.connectionOauthDescription":
    "Deze leverancier antwoordt als degene die vraagt. De omgeving registreert een OAuth-client, en iedereen koppelt zijn eigen account, dus een Bot ziet alleen wat die persoon kan zien.",
  "admin-b.plugin.disableBotsOne": "{count} Bot",
  "admin-b.plugin.disableBotsOther": "{count} Bots",
  "admin-b.plugin.disableConfirm": "Uitzetten",
  "admin-b.plugin.disableGrantsOne": "{count} toekenning",
  "admin-b.plugin.disableGrantsOther": "{count} toekenningen",
  "admin-b.plugin.disableLossOne":
    "{grants} bij {bots} gaat mee, en weer aanzetten brengt die niet terug.",
  "admin-b.plugin.disableLossOther":
    "{grants} bij {bots} gaan mee, en weer aanzetten brengt die niet terug.",
  "admin-b.plugin.disableNothingLost":
    "Geen enkele Bot heeft nog een van zijn tools, dus er gaat verder niets verloren.",
  "admin-b.plugin.disableTitle": "{title} uitzetten voor deze omgeving?",
  "admin-b.plugin.disabledDescription":
    "Geen enkele Bot kan deze leverancier bereiken. Zet hem aan om hem in te stellen en zijn tools toe te kennen.",
  "admin-b.plugin.documentation": "Documentatie",
  "admin-b.plugin.documentationDescription":
    "Wat deze tools bieden, van de mensen die ze onderhouden.",
  "admin-b.plugin.enable": "Inschakelen voor deze omgeving",
  "admin-b.plugin.enableLabel": "{title} inschakelen voor deze omgeving",
  "admin-b.plugin.enabledDescription":
    "Bots kunnen zijn tools toegekend krijgen. Uitzetten verwijdert hem en elke toekenning op zijn tools.",
  "admin-b.plugin.grant": "Toekennen",
  "admin-b.plugin.grantDialogDescription":
    "Elke toekenning is een eigen regel in de audit, en een toegekende schrijfactie wordt bij elke aanroep nog steeds aan de grenzen getoetst.",
  "admin-b.plugin.grantDialogTitle": "Tools toekennen",
  "admin-b.plugin.grantSummarySentence": "Ken {tools}{writes} toe aan {names}.",
  "admin-b.plugin.grantSummaryToolsOne": "{count} tool",
  "admin-b.plugin.grantSummaryToolsOther": "{count} tools",
  "admin-b.plugin.grantSummaryWritesOne": ", waarvan {count} iets verandert,",
  "admin-b.plugin.grantSummaryWritesOther":
    ", waarvan {count} iets veranderen,",
  "admin-b.plugin.grantTo": "Aan",
  "admin-b.plugin.grantTools": "Tools toekennen…",
  "admin-b.plugin.granting": "Bezig met {done} van {total}…",
  "admin-b.plugin.held": "Aanwezig",
  "admin-b.plugin.instanceHost": "Instance-host",
  "admin-b.plugin.instanceHostDescription":
    "Deze leverancier geeft elke klant een eigen hostnaam, die aan zijn patroon wordt getoetst voordat er iets wordt opgeslagen.",
  "admin-b.plugin.instanceHostDialogDescription":
    "Je eigen hostnaam bij deze leverancier. Die wordt aan hun patroon getoetst voordat er iets wordt opgeslagen.",
  "admin-b.plugin.instanceHostFor": "Instance-host voor {title}",
  "admin-b.plugin.instanceHostPlaceholder":
    "https://jouw-instance.service-now.com",
  "admin-b.plugin.noBots": "Geen Bots",
  "admin-b.plugin.noPublicUrl":
    "Deze omgeving heeft geen publieke URL, dus niemand kan een toestemmingsflow afronden. Stel OPENBOT_PUBLIC_URL in.",
  "admin-b.plugin.notFoundDescription":
    "Deze omgeving heeft geen plugin met die naam, en de catalogus biedt er ook geen aan.",
  "admin-b.plugin.notFoundEmpty": "Niets in te stellen.",
  "admin-b.plugin.notFoundTitle": "Geen plugin",
  "admin-b.plugin.notListedBy": "Niet vermeld door {title}.",
  "admin-b.plugin.notListedByAsOf":
    "Niet vermeld door {title} bij de laatste verversing.",
  "admin-b.plugin.notRegistered": "Niet geregistreerd",
  "admin-b.plugin.notSet": "Niet ingesteld",
  "admin-b.plugin.oauthClient": "OAuth-client",
  "admin-b.plugin.oauthClientDescription":
    "Identificeert deze omgeving bij de leverancier. Op zichzelf bereikt hij niemands documenten.",
  "admin-b.plugin.oauthClientDialogDescription":
    "Uit de console van de leverancier. Het geheim wordt bewaard in de kluis van deze omgeving en nooit teruggelezen.",
  "admin-b.plugin.oauthClientDynamicDescription":
    "Deze omgeving registreert zichzelf bij de leverancier bij de eerste koppeling. Er is niets om te plakken.",
  "admin-b.plugin.oauthClientFor": "OAuth-client voor {title}",
  "admin-b.plugin.oneBot": "1 Bot",
  "admin-b.plugin.pendingTitle": "Plugin",
  "admin-b.plugin.reads": "leest",
  "admin-b.plugin.readsHeading": "Leest",
  "admin-b.plugin.redirectDynamic":
    "De omgeving registreert zijn redirect-URI zelf, dus bij de leverancier hoeft niets toegevoegd te worden.",
  "admin-b.plugin.redirectInstruction":
    "Voeg dit toe aan de toegestane redirect-URI's van de client bij de leverancier, precies zoals het er staat. Eén verkeerd teken gaat daar al mis, met een melding waarin OpenBot niet voorkomt.",
  "admin-b.plugin.refreshTools": "Tools verversen",
  "admin-b.plugin.registered": "Geregistreerd",
  "admin-b.plugin.save": "Opslaan",
  "admin-b.plugin.selectAll": "Alles selecteren",
  "admin-b.plugin.selfRegistered": "Zelf geregistreerd",
  "admin-b.plugin.someBots": "{held} van {total} Bots",
  "admin-b.plugin.tools": "Tools",
  "admin-b.plugin.toolsDescription":
    "Een Bot hoort pas van een tool als hij hem heeft. Over elke aanroep wordt op het moment zelf opnieuw beslist, dus een toekenning intrekken werkt vanaf de volgende aanroep.",
  "admin-b.plugin.toolsEmpty":
    "Geen tools vermeld. Ververs om het de leverancier opnieuw te vragen.",
  "admin-b.plugin.vendorDocumentation": "Documentatie van de leverancier",
  "admin-b.plugin.vendorDocumentationDescription":
    "Wat deze server biedt, van de mensen die hem onderhouden.",
  "admin-b.plugin.withdrawn": "Toegekend maar niet aangeboden",
  "admin-b.plugin.withdrawnDescription":
    "Deze leverancier vermeldt deze niet meer, dus geen Bot hoort ervan en geen model kan er een aanroepen. De toekenning staat nog vast, en de tool wordt weer aangeboden zodra de leverancier hem opnieuw vermeldt. Trek hem in op de eigen pagina van de Bot als je dat niet wilt.",
  "admin-b.plugin.yourAccount": "Je account",
  "admin-b.plugin.yourAccountConnected":
    "Gekoppeld, dus een Bot met deze tools gebruikt jouw {title} namens jou. Alle anderen koppelen hun eigen account.",
  "admin-b.plugin.yourAccountDescription":
    "Koppel je eigen account om deze connector te proberen. De instelling is compleet zonder, en hij bereikt alleen jouw documenten.",
  "admin-b.pluginTool.backFallback": "Plugin",
  "admin-b.pluginTool.bots": "Bots",
  "admin-b.pluginTool.botsDescription":
    "Een Bot mag deze tool alleen aanroepen zolang zijn schakelaar aan staat. Eén uitzetten werkt vanaf de volgende aanroep, zonder dat er iets in een cache achterblijft. Elke aanroep wordt nog steeds aan de grenzen getoetst en in de audit vastgelegd.",
  "admin-b.pluginTool.cannotCallBack": "kan niet terugroepen",
  "admin-b.pluginTool.changesThings": "verandert iets",
  "admin-b.pluginTool.connectorDisabled":
    "Deze omgeving heeft die connector niet ingeschakeld.",
  "admin-b.pluginTool.effect": "Effect",
  "admin-b.pluginTool.effectDescription":
    "Bepaald door de connector, niet door de naam van de tool. Alles wat niet herkend wordt telt als schrijven.",
  "admin-b.pluginTool.letCall": "Laat {name} {tool} aanroepen",
  "admin-b.pluginTool.noBots":
    "Deze omgeving heeft nog geen Bots, dus er is niemand om dit aan toe te kennen.",
  "admin-b.pluginTool.noDescription": "Deze tool kwam zonder beschrijving.",
  "admin-b.pluginTool.notFoundDescription":
    "Deze connector biedt geen tool met die naam aan.",
  "admin-b.pluginTool.pendingTitle": "Tool",
  "admin-b.pluginTool.readDescription":
    "Deze tool leest alleen. Een grens die over schrijven gaat geldt er niet voor.",
  "admin-b.pluginTool.reads": "leest",
  "admin-b.pluginTool.stuckExplanation":
    "Ze hebben geen toegangsgegevens om tools mee terug te roepen, dus elke aanroep wordt geweigerd voordat hij de grens bereikt. Geef er een uit op de eigen pagina van elke Bot, of stel",
  "admin-b.pluginTool.stuckExplanationTail": "in voor de omgeving.",
  "admin-b.pluginTool.stuckOne":
    "{count} Bot heeft deze tool maar kan hem nog niet aanroepen.",
  "admin-b.pluginTool.stuckOther":
    "{count} Bots hebben deze tool maar kunnen hem nog niet aanroepen.",
  "admin-b.pluginTool.whatItDoes": "Wat hij doet",
  "admin-b.pluginTool.withdrawn":
    "Misschien is hij ingetrokken sinds de toollijst voor het laatst is ververst.",
  "admin-b.pluginTool.writeDescription":
    "Deze tool verandert iets bij de leverancier. Een grens die over schrijven gaat geldt ervoor, en de aanroep wordt geweigerd zodra er een past.",
  "admin-b.plugins.added": "Toegevoegd",
  "admin-b.plugins.addedDescription":
    "Toegevoegd voor de hele omgeving. Open er een om in te stellen wat hij nodig heeft en welke Bots zijn tools hebben.",
  "admin-b.plugins.addedEmpty":
    "Nog niets toegevoegd. Alles wat beschikbaar is staat hieronder.",
  "admin-b.plugins.botsOne": "{count} Bot",
  "admin-b.plugins.botsOther": "{count} Bots",
  "admin-b.plugins.connectYourAccount": "koppel je account",
  "admin-b.plugins.description":
    "Wat deze omgeving kan bereiken, en welke Bots dat mogen. Een plugin toevoegen geldt voor het hele account; welke Bots zijn tools hebben bepaal je op de eigen pagina van de plugin.",
  "admin-b.plugins.explore": "Plugins verkennen",
  "admin-b.plugins.exploreDescription":
    "Beoordeelde servers van de leveranciers zelf waar deze build mee praat. Open er een om hem toe te voegen.",
  "admin-b.plugins.exploreEmpty": "Alles uit de catalogus is toegevoegd.",
  "admin-b.plugins.loadFailed": "De plugins konden niet worden geladen.",
  "admin-b.plugins.noBots": "geen Bots",
  "admin-b.plugins.noToolsYet": "Nog geen tools",
  "admin-b.plugins.notAdded": "Niet toegevoegd",
  "admin-b.plugins.title": "Plugins",
  "admin-b.plugins.toolsOne": "{count} tool",
  "admin-b.plugins.toolsOther": "{count} tools",
  "admin-b.plugins.yourAccountConnected": "je account is gekoppeld",
  "admin-b.skills.cancel": "Annuleren",
  "admin-b.skills.description":
    "Instructies met een naam die iedereen hier kan oproepen met een slash. Een skill voegt geen mogelijkheden toe: hij kan een Bot alleen vragen te gebruiken wat die Bot al heeft, en over elke aanroep wordt nog steeds beslist en die wordt vastgelegd.",
  "admin-b.skills.done": "Klaar",
  "admin-b.skills.empty": "Nog geen skills.",
  "admin-b.skills.giveLabel": "Geef {name} /{slug}",
  "admin-b.skills.grantedNone": "Er zijn nog geen Bots",
  "admin-b.skills.grantedToAllOne": "Toegekend aan de enige Bot",
  "admin-b.skills.grantedToAllOther": "Toegekend aan alle {total} Bots",
  "admin-b.skills.grantedToNone": "Aan geen enkele Bot toegekend",
  "admin-b.skills.grantedToSome": "Toegekend aan {held} van {total} Bots",
  "admin-b.skills.install": "Skill installeren",
  "admin-b.skills.installed": "Geïnstalleerd",
  "admin-b.skills.installedDescription":
    "Geschreven voor de hele omgeving. Mensen schrijven hun eigen skills op hun eigen Skills-pagina.",
  "admin-b.skills.instructions": "Instructies",
  "admin-b.skills.instructionsPlaceholder":
    "Wat de Bot moet doen als deze skill wordt gebruikt.",
  "admin-b.skills.manage": "Beheren",
  "admin-b.skills.noBots": "Er zijn nog geen Bots.",
  "admin-b.skills.remove": "Verwijderen",
  "admin-b.skills.removeDescription":
    "Elke Bot raakt hem kwijt, en wie /{slug} typt krijgt niets. Dit kan niet ongedaan worden gemaakt.",
  "admin-b.skills.removeTitle": "/{slug} verwijderen voor de hele omgeving?",
  "admin-b.skills.slug": "Slug",
  "admin-b.skills.slugPlaceholder": "standup-notities",
  "admin-b.skills.summary": "Samenvatting",
  "admin-b.skills.summaryPlaceholder": "Eén regel",
  "admin-b.skills.title": "Skills",
  "admin-b.skills.titleLabel": "Titel",
  "admin-b.skills.titlePlaceholder": "Titel",
  "admin-b.skills.whoHas": "Wie heeft /{slug}",
  "admin-b.skills.whoHasDescription":
    "Een Bot met de schakelaar aan krijgt deze instructies zodra iemand de slash typt. Elke wijziging gaat meteen in.",
  "admin-b.skills.write": "Skill schrijven",
  "admin-b.skills.writeDescription":
    "De slug is wat iemand na een slash typt, en de instructies worden dan aan de run toegevoegd. Iedereen hier kan hem gebruiken, en jij bepaalt welke Bots hem hebben.",
  "admin-b.skills.writeTitle": "Een skill schrijven voor de omgeving",
  "admin-b.workspaces.add": "Toevoegen",
  "admin-b.workspaces.cancel": "Annuleren",
  "admin-b.workspaces.demoSuffix": "(demo)",
  "admin-b.workspaces.description":
    "Elke NOTOS-klant is een workspace. Het model blijft standaard in de EU; global is een bewuste keuze per workspace, omdat dat verkeer de EU verlaat.",
  "admin-b.workspaces.driveFolderLinks": "Links naar Drive-mappen",
  "admin-b.workspaces.driveFolderPlaceholder":
    "https://drive.google.com/drive/folders/…",
  "admin-b.workspaces.driveFoldersOne": "Drive: {count} map",
  "admin-b.workspaces.driveFoldersOther": "Drive: {count} mappen",
  "admin-b.workspaces.emailAddress": "E-mailadres",
  "admin-b.workspaces.emailPlaceholder": "naam@bedrijf.nl",
  "admin-b.workspaces.empty":
    "Nog geen workspaces: de NOTOS-sync heeft nog niets opgehaald.",
  "admin-b.workspaces.hideMembers": "Leden verbergen",
  "admin-b.workspaces.loadFailed": "De workspaces konden niet worden geladen.",
  "admin-b.workspaces.loading": "Laden…",
  "admin-b.workspaces.members": "Leden ({count})",
  "admin-b.workspaces.modelFor": "Model voor {name}",
  "admin-b.workspaces.noDriveFolder": "Geen Drive-map",
  "admin-b.workspaces.noMembers":
    "Hier is nog niemand toegevoegd. Mensen die NOTOS al binnenlaat houden hun toegang.",
  "admin-b.workspaces.ownSetting": "Eigen instelling",
  "admin-b.workspaces.ownSettingDetail":
    "{model} op {where} (eigen instelling)",
  "admin-b.workspaces.remove": "Verwijderen",
  "admin-b.workspaces.role": "Rol",
  "admin-b.workspaces.save": "Opslaan",
  "admin-b.workspaces.title": "Workspaces",
};

export default adminUb;
