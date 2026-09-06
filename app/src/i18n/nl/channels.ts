// NOTOS i18n: channels (nl). Keys: "channels.<file>.<name>". Add keys in both languages.
const channels: Record<string, string> = {
  "channels.activity-log.boundaryRefused": "Een grens heeft dit geweigerd.",
  "channels.activity-log.empty":
    "Nog niets. Commando's die de Bot uitvoert en bestanden die hij leest, verschijnen hier zodra het gebeurt.",
  "channels.activity-log.labelCommand": "Uitgevoerd",
  "channels.activity-log.labelListed": "Opgesomd",
  "channels.activity-log.labelRead": "Gelezen",
  "channels.activity-log.labelSaved": "Opgeslagen",
  "channels.approval-card.approved":
    "Goedgekeurd. De Bot mag dit één keer doen.",
  "channels.approval-card.approvedBy":
    "Goedgekeurd door {name}. De Bot mag dit één keer doen.",
  "channels.approval-card.decideFailed":
    "De beslissing kon niet worden vastgelegd.",
  "channels.approval-card.declined": "Afgewezen. Er is niets veranderd.",
  "channels.approval-card.declinedBy":
    "Afgewezen door {name}. Er is niets veranderd.",
  "channels.approval-card.goAhead":
    "Goedgekeurd: ga door met {label}, met dezelfde details.",
  "channels.approval-card.loadFailed":
    "De details van deze aanroep konden niet worden geladen.",
  "channels.approval-card.no": "Nee",
  "channels.approval-card.noDetails": "Zonder details.",
  "channels.approval-card.question": "Mag deze Bot {label}?",
  "channels.approval-card.yes": "Ja, doe maar",
  "channels.avatar.working": "Bezig…",
  "channels.bot-thread-chat.unreadableOne":
    "Eén eerder bericht kon niet worden gelezen en wordt niet getoond.",
  "channels.bot-thread-chat.unreadableOther":
    "{count} eerdere berichten konden niet worden gelezen en worden niet getoond.",
  "channels.channel-chat.botDeleted":
    "Deze Bot is verwijderd. Het gesprek blijft leesbaar, maar de Bot kan niet meer antwoorden.",
  "channels.channel-chat.restComplete": "De rest van dit gesprek is compleet.",
  "channels.channel-chat.unreadableOne":
    "Eén eerder bericht kon niet worden gelezen en wordt niet getoond.",
  "channels.channel-chat.unreadableOther":
    "{count} eerdere berichten konden niet worden gelezen en worden niet getoond.",
  "channels.chat-transcript.generatedInterface":
    "De gegenereerde interface van deze Bot",
  "channels.chat-transcript.loading": "Dit gesprek wordt geladen",
  "channels.chat-transcript.queued": "In de wachtrij",
  "channels.chat-transcript.remove": "Verwijderen",
  "channels.chat-transcript.removeQueuedLabel":
    "Bericht uit de wachtrij halen: {text}",
  "channels.chat-transcript.thinking": "Denkt na",
  "channels.command-output.exitCode": "Exitcode {code}.",
  "channels.command-output.nothingPrinted": "Er kwam geen uitvoer.",
  "channels.command-output.timedOut": "Het duurde te lang en is gestopt.",
  "channels.command-output.truncated":
    "De uitvoer is aan het begin afgekapt. Wat volgt is het einde ervan.",
  "channels.composer.messageLabel": "Bericht",
  "channels.composer.moreOptionsUnavailable":
    "Meer berichtopties zijn niet beschikbaar",
  "channels.composer.placeholder": "Vraag wat je wilt",
  "channels.composer.queueMessage": "Bericht in de wachtrij zetten",
  "channels.composer.sendMessage": "Bericht versturen",
  "channels.composer.stopBot": "Stop de Bot",
  "channels.computer-view.aPage": "Een pagina",
  "channels.computer-view.assistantMayBeWorking":
    "De assistent werkt mogelijk nog. Een beheerder kan controleren of de computer draait.",
  "channels.computer-view.assistantNeedsSecret": "De assistent vraagt om",
  "channels.computer-view.assistantNeedsYou": "De assistent heeft je nodig.",
  "channels.computer-view.cannotSeeScreen": "Je kunt het scherm nu niet zien",
  "channels.computer-view.closeScreen": "Het scherm van de assistent sluiten",
  "channels.computer-view.handBack": "Teruggeven",
  "channels.computer-view.noPageThisTurn":
    "Deze beurt heeft geen pagina geopend.",
  "channels.computer-view.noPageYet":
    "De assistent heeft nog geen pagina geopend.",
  "channels.computer-view.openFullSize":
    "Het scherm van de assistent op volledige grootte openen",
  "channels.computer-view.openedDuringTurn":
    "Geopend tijdens deze beurt. Het scherm is inmiddels verder gegaan.",
  "channels.computer-view.screenAlt": "Waar de assistent naar kijkt",
  "channels.computer-view.screenDialog": "Het scherm van de assistent",
  "channels.computer-view.screenUnavailable":
    "Het scherm is nu niet beschikbaar.",
  "channels.computer-view.secretExplainer":
    "Dit gaat rechtstreeks naar de pagina. Het komt niet in het gesprek en de assistent krijgt het nooit te zien.",
  "channels.computer-view.secretPlaceholder":
    "Typ het hier, de assistent ziet het nooit",
  "channels.computer-view.sendToPage": "Naar de pagina sturen",
  "channels.computer-view.sending": "Versturen…",
  "channels.computer-view.takeControl": "Controle overnemen",
  "channels.computer-view.turnFrameAlt": "Wat deze beurt open had",
  "channels.computer-view.waitingForScreen":
    "Wachten op het scherm van de assistent…",
  "channels.computer-view.youHaveControl": "Jij hebt de controle",
  "channels.computer-view.youHaveControlHint":
    "Jij hebt de controle: klik en typ op de pagina.",
  "channels.conversation-view.intro":
    "Stel een vraag of zeg wat je nodig hebt; het antwoord komt hier.",
  "channels.live-screen.couldNotReach": "Het live scherm is niet bereikbaar.",
  "channels.live-screen.couldNotShow": "Het scherm kon niet worden getoond.",
  "channels.live-screen.screenLabelDriving":
    "Het scherm van de assistent. Jij hebt de controle: klik en typ hier.",
  "channels.live-screen.screenLabelLive": "Het scherm van de assistent, live",
  "channels.routines-list.cancel": "Annuleren",
  "channels.routines-list.channelGone": "Dit kanaal bestaat niet meer",
  "channels.routines-list.delete": "Verwijderen",
  "channels.routines-list.deleteDescription":
    "Deze staande opdracht stopt voorgoed. Er draait niets meer op dit schema, en je kunt dit niet ongedaan maken.",
  "channels.routines-list.deleteLabel":
    "De routine met schema {schedule} verwijderen",
  "channels.routines-list.deleteTitle": '"{schedule}" verwijderen?',
  "channels.routines-list.deleting": "Verwijderen…",
  "channels.routines-list.due": "Staat klaar",
  "channels.routines-list.emptyBotDescriptionAfter": ".",
  "channels.routines-list.emptyBotDescriptionBefore":
    'Vraag het in een kanaal ("elke werkdag om 9 uur, …"), of maak er een aan op de',
  "channels.routines-list.emptyBotDescriptionLink": "Routines-pagina",
  "channels.routines-list.emptyBotTitle": "Niets ingepland voor deze Bot",
  "channels.routines-list.emptyDescription":
    'Gebruik Nieuwe routine hierboven, of vraag het een Bot in een kanaal ("elke werkdag om 9 uur, …"). Die verschijnt dan hier.',
  "channels.routines-list.emptyTitle": "Niets ingepland",
  "channels.routines-list.enableLabel":
    "De routine met schema {schedule} inschakelen",
  "channels.routines-list.failedAt": "Mislukt {when}",
  "channels.routines-list.finishedAt": "Afgerond {when}",
  "channels.routines-list.loadFailed":
    "Je routines konden niet worden geladen.",
  "channels.routines-list.loadingRoutines": "Routines worden geladen",
  "channels.routines-list.neverRun": "Nog nooit gedraaid",
  "channels.routines-list.nextAt": "Volgende {when}",
  "channels.routines-list.paused": "Gepauzeerd",
  "channels.routines-list.ranAt": "Gedraaid {when}",
  "channels.routines-list.recently": "onlangs",
  "channels.routines-list.running": "Draait…",
  "channels.routines-list.skippedAt": "Overgeslagen {when}",
  "channels.routines-list.unnamedChannel": "Naamloos kanaal",
  "channels.sources.summarizeDescription": "Vat dit gesprek samen",
  "channels.sources.summarizePrompt":
    "Vat samen wat we tot nu toe in dit kanaal hebben besproken.",
  "channels.tool-boundary.couldNotDraw": "kon niet worden weergegeven.",
  "channels.tool-boundary.restUnaffected":
    "De rest van dit gesprek werkt gewoon door.",
  "channels.tool-line.blocked": "Geblokkeerd",
  "channels.tool-line.failed": "{label}, niet gelukt",
  "channels.triggers.botLabel": "Bot",
  "channels.triggers.commandLabel": "commando",
  "channels.triggers.noBots": "Geen Bots in dit kanaal",
  "channels.triggers.noCommands": "Geen commando's gevonden",
};

export default channels;
