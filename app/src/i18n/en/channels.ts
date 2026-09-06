// NOTOS i18n: channels (en). Keys: "channels.<file>.<name>". Add keys in both languages.
const channels: Record<string, string> = {
  "channels.activity-log.boundaryRefused": "A boundary refused it.",
  "channels.activity-log.empty":
    "Nothing yet. Commands the Bot runs, and files it reads, appear here as they happen.",
  "channels.activity-log.labelCommand": "Ran",
  "channels.activity-log.labelListed": "Listed",
  "channels.activity-log.labelRead": "Read",
  "channels.activity-log.labelSaved": "Saved",
  "channels.approval-card.approved": "Approved. The Bot may do this once.",
  "channels.approval-card.approvedBy":
    "Approved by {name}. The Bot may do this once.",
  "channels.approval-card.decideFailed": "The decision could not be recorded.",
  "channels.approval-card.declined": "Declined. Nothing was changed.",
  "channels.approval-card.declinedBy":
    "Declined by {name}. Nothing was changed.",
  "channels.approval-card.goAhead":
    "Approved: go ahead with {label}, with the same details.",
  "channels.approval-card.loadFailed":
    "The details of this call could not be loaded.",
  "channels.approval-card.no": "No",
  "channels.approval-card.noDetails": "Without any details.",
  "channels.approval-card.question": "May this Bot {label}?",
  "channels.approval-card.yes": "Yes, do it",
  "channels.avatar.working": "Working…",
  "channels.bot-thread-chat.unreadableOne":
    "One earlier message could not be read and is not shown.",
  "channels.bot-thread-chat.unreadableOther":
    "{count} earlier messages could not be read and are not shown.",
  "channels.channel-chat.botDeleted":
    "This Bot has been deleted. The conversation stays readable, but it can no longer reply.",
  "channels.channel-chat.restComplete":
    "The rest of this conversation is complete.",
  "channels.channel-chat.unreadableOne":
    "One earlier message could not be read and is not shown.",
  "channels.channel-chat.unreadableOther":
    "{count} earlier messages could not be read and are not shown.",
  "channels.chat-transcript.generatedInterface":
    "This Bot's generated interface",
  "channels.chat-transcript.loading": "Loading this conversation",
  "channels.chat-transcript.queued": "Queued",
  "channels.chat-transcript.remove": "Remove",
  "channels.chat-transcript.removeQueuedLabel": "Remove queued message: {text}",
  "channels.chat-transcript.thinking": "Thinking",
  "channels.command-output.exitCode": "Exit code {code}.",
  "channels.command-output.nothingPrinted": "It printed nothing.",
  "channels.command-output.timedOut": "It ran too long and was stopped.",
  "channels.command-output.truncated":
    "Output was cut short at the start. What follows is the end of it.",
  "channels.composer.messageLabel": "Message",
  "channels.composer.moreOptionsUnavailable":
    "More message options unavailable",
  "channels.composer.placeholder": "Ask anything",
  "channels.composer.queueMessage": "Queue message",
  "channels.composer.sendMessage": "Send message",
  "channels.composer.stopBot": "Stop the Bot",
  "channels.computer-view.aPage": "A page",
  "channels.computer-view.assistantMayBeWorking":
    "The assistant may still be working. An administrator can check whether its computer is running.",
  "channels.computer-view.assistantNeedsSecret": "The assistant needs",
  "channels.computer-view.assistantNeedsYou": "The assistant needs you.",
  "channels.computer-view.cannotSeeScreen":
    "You cannot see the screen right now",
  "channels.computer-view.closeScreen": "Close the assistant's screen",
  "channels.computer-view.handBack": "Hand back",
  "channels.computer-view.noPageThisTurn": "This turn did not open a page.",
  "channels.computer-view.noPageYet":
    "The assistant has not opened a page yet.",
  "channels.computer-view.openFullSize":
    "Open the assistant's screen full size",
  "channels.computer-view.openedDuringTurn":
    "Opened during this turn. The screen has moved on since.",
  "channels.computer-view.screenAlt": "What the assistant is looking at",
  "channels.computer-view.screenDialog": "The assistant's screen",
  "channels.computer-view.screenUnavailable":
    "The screen is not available right now.",
  "channels.computer-view.secretExplainer":
    "This goes straight to the page. It is not shown in the conversation and the assistant never receives it.",
  "channels.computer-view.secretPlaceholder":
    "Typed here, never shown to the assistant",
  "channels.computer-view.sendToPage": "Send to the page",
  "channels.computer-view.sending": "Sending…",
  "channels.computer-view.takeControl": "Take control",
  "channels.computer-view.turnFrameAlt": "What this turn had open",
  "channels.computer-view.waitingForScreen":
    "Waiting for the assistant's screen…",
  "channels.computer-view.youHaveControl": "You have control",
  "channels.computer-view.youHaveControlHint":
    "You have control: click and type on the page.",
  "channels.conversation-view.intro":
    "Ask a question or say what you need; the answer lands here.",
  "channels.live-screen.couldNotReach": "The live screen could not be reached.",
  "channels.live-screen.couldNotShow": "The screen could not be shown.",
  "channels.live-screen.screenLabelDriving":
    "The assistant's screen. You have control: click and type here.",
  "channels.live-screen.screenLabelLive": "The assistant's screen, live",
  "channels.routines-list.cancel": "Cancel",
  "channels.routines-list.channelGone": "This channel is gone",
  "channels.routines-list.delete": "Delete",
  "channels.routines-list.deleteDescription":
    "This standing instruction stops for good. Nothing further runs on this schedule, and there is no undo.",
  "channels.routines-list.deleteLabel":
    "Delete the routine scheduled {schedule}",
  "channels.routines-list.deleteTitle": 'Delete "{schedule}"?',
  "channels.routines-list.deleting": "Deleting…",
  "channels.routines-list.due": "Due",
  "channels.routines-list.emptyBotDescriptionAfter": ".",
  "channels.routines-list.emptyBotDescriptionBefore":
    'Ask it in a channel ("every weekday at 9, …"), or make one on the',
  "channels.routines-list.emptyBotDescriptionLink": "Routines page",
  "channels.routines-list.emptyBotTitle": "Nothing scheduled for this Bot",
  "channels.routines-list.emptyDescription":
    'Use New routine above, or ask a Bot in a channel ("every weekday at 9, …"). It appears here.',
  "channels.routines-list.emptyTitle": "Nothing scheduled",
  "channels.routines-list.enableLabel":
    "Enable the routine scheduled {schedule}",
  "channels.routines-list.failedAt": "Failed {when}",
  "channels.routines-list.finishedAt": "Finished {when}",
  "channels.routines-list.loadFailed": "Your routines could not be loaded.",
  "channels.routines-list.loadingRoutines": "Loading routines",
  "channels.routines-list.neverRun": "Never run yet",
  "channels.routines-list.nextAt": "Next {when}",
  "channels.routines-list.paused": "Paused",
  "channels.routines-list.ranAt": "Ran {when}",
  "channels.routines-list.recently": "recently",
  "channels.routines-list.running": "Running…",
  "channels.routines-list.skippedAt": "Skipped {when}",
  "channels.routines-list.unnamedChannel": "Unnamed channel",
  "channels.sources.summarizeDescription": "Summarize this conversation",
  "channels.sources.summarizePrompt":
    "Summarize what we covered in this channel so far.",
  "channels.tool-boundary.couldNotDraw": "could not be drawn.",
  "channels.tool-boundary.restUnaffected":
    "The rest of this conversation is unaffected.",
  "channels.tool-line.blocked": "Blocked",
  "channels.tool-line.failed": "{label}, didn't work",
  "channels.triggers.botLabel": "Bot",
  "channels.triggers.commandLabel": "command",
  "channels.triggers.noBots": "No Bots in this channel",
  "channels.triggers.noCommands": "No matching commands",
};

export default channels;
