// NOTOS i18n: admin-a (en). Keys: "admin-a.<file>.<name>". Add keys in both languages.
const adminUa: Record<string, string> = {
  "admin-a.admin-sidebar.auditDescription":
    "Every action taken in this deployment, and by whom.",
  "admin-a.admin-sidebar.auditTitle": "Audit",
  "admin-a.admin-sidebar.backToApp": "Back to app",
  "admin-a.admin-sidebar.boundariesDescription":
    "Rules that decide what a Bot may never do.",
  "admin-a.admin-sidebar.boundariesTitle": "Boundaries",
  "admin-a.admin-sidebar.componentsDescription":
    "Custom pieces a Bot can draw in a conversation.",
  "admin-a.admin-sidebar.componentsTitle": "UI Components",
  "admin-a.admin-sidebar.computersDescription":
    "The machines Bots run their tools on.",
  "admin-a.admin-sidebar.computersTitle": "Computers",
  "admin-a.admin-sidebar.credentialsDescription":
    "Keys and tokens held for this deployment.",
  "admin-a.admin-sidebar.credentialsTitle": "Credentials",
  "admin-a.admin-sidebar.groupAccessLabel": "Who can get in",
  "admin-a.admin-sidebar.groupDoDescription":
    "Capabilities and interface pieces available across Bots.",
  "admin-a.admin-sidebar.groupDoLabel": "What Bots can do",
  "admin-a.admin-sidebar.groupHappenedLabel": "What happened",
  "admin-a.admin-sidebar.groupReachDescription":
    "Everything a Bot can touch outside this app, and the limits on it.",
  "admin-a.admin-sidebar.groupReachLabel": "What Bots can reach",
  "admin-a.admin-sidebar.modelsDescription":
    "API keys for the model providers that need one; Gemini on Vertex needs none.",
  "admin-a.admin-sidebar.modelsTitle": "Models",
  "admin-a.admin-sidebar.overview": "Overview",
  "admin-a.admin-sidebar.peopleDescription":
    "Everybody who has signed in, who administers this deployment, and whose access has been removed.",
  "admin-a.admin-sidebar.peopleTitle": "People",
  "admin-a.admin-sidebar.playgroundDescription":
    "Write a component and watch it render as you type.",
  "admin-a.admin-sidebar.playgroundTitle": "Playground",
  "admin-a.admin-sidebar.pluginsDescription":
    "The services this deployment can reach, and which Bots may.",
  "admin-a.admin-sidebar.pluginsTitle": "Plugins",
  "admin-a.admin-sidebar.skillsDescription":
    "Named instructions anybody can invoke with a slash.",
  "admin-a.admin-sidebar.skillsTitle": "Skills",
  "admin-a.admin-sidebar.workspacesDescription":
    "Every NOTOS client, the model it runs on, its Drive folders and who is in it.",
  "admin-a.admin-sidebar.workspacesTitle": "Workspaces",
  "admin-a.audit.allowed": "Allowed",
  "admin-a.audit.blocked": "Blocked",
  "admin-a.audit.colBot": "Bot",
  "admin-a.audit.colDecision": "Decision",
  "admin-a.audit.colOn": "On",
  "admin-a.audit.colWhat": "What",
  "admin-a.audit.colWhen": "When",
  "admin-a.audit.decisionApprovalDenied": "Declined by a person",
  "admin-a.audit.decisionApprovalGranted": "Approved by a person",
  "admin-a.audit.decisionApprovalRequested": "Waiting for a person",
  "admin-a.audit.decisionBotDeclined": "The Bot declined",
  "admin-a.audit.decisionCallFailed": "The server did not answer",
  "admin-a.audit.decisionCallSucceeded": "Called on this Bot's behalf",
  "admin-a.audit.decisionCallbackRefused": "Could not prove which Bot it was",
  "admin-a.audit.decisionComponentGranted": "Granted to this Bot",
  "admin-a.audit.decisionComponentPublished":
    "Published, so every Bot may use it",
  "admin-a.audit.decisionComponentRevoked": "Taken away from this Bot",
  "admin-a.audit.decisionComponentUnpublished":
    "Unpublished, so no Bot may use it",
  "admin-a.audit.decisionConfigurationChanged": "Configuration changed",
  "admin-a.audit.decisionControlReleased": "The wheel was handed back",
  "admin-a.audit.decisionControlTaken": "A person took the wheel",
  "admin-a.audit.decisionCredentialCreated": "Credential saved",
  "admin-a.audit.decisionDraftSaved": "Draft saved, not yet published",
  "admin-a.audit.decisionFunctionCalled": "Read real data",
  "admin-a.audit.decisionFunctionFailed": "Could not be read",
  "admin-a.audit.decisionFunctionGranted": "May read this",
  "admin-a.audit.decisionFunctionRevoked": "May no longer read this",
  "admin-a.audit.decisionHelpRequested": "The Bot asked for help",
  "admin-a.audit.decisionIsolationLoaded": "Isolation at start-up",
  "admin-a.audit.decisionPolicyLoaded": "Boundary at start-up",
  "admin-a.audit.decisionRefused": "Refused",
  "admin-a.audit.decisionReset": "The computer was reset",
  "admin-a.audit.decisionSecretRequested": "The Bot asked for a secret",
  "admin-a.audit.decisionSecretSupplied": "A person supplied a secret",
  "admin-a.audit.decisionStopped": "A person pressed stop",
  "admin-a.audit.decisionStreamStalled": "The Bot stopped responding",
  "admin-a.audit.decisionToolsDiscovered": "Tools offered for one run",
  "admin-a.audit.description":
    "Every action a Bot took, and every one this deployment's policy refused.",
  "admin-a.audit.didNotHappen": "Did not happen",
  "admin-a.audit.discoveryNothingChosen":
    "No skill applied, so all were offered",
  "admin-a.audit.discoveryNothingDeclared":
    "No skill declares any of these tools",
  "admin-a.audit.discoverySelected": "Chosen by skill",
  "admin-a.audit.discoveryUnavailable": "Could not choose, so all were offered",
  "admin-a.audit.discoveryUnderFloor": "Few enough tools to offer them all",
  "admin-a.audit.dryRunNote": "dry-run: recorded, not enforced",
  "admin-a.audit.empty": "No events match this filter yet.",
  "admin-a.audit.filterApprovals": "Approvals",
  "admin-a.audit.filterComputerActions": "Computer actions",
  "admin-a.audit.filterEverything": "Everything",
  "admin-a.audit.filterNeedsApproval": "Needs approval",
  "admin-a.audit.loadFailed": "The audit trail could not be loaded.",
  "admin-a.audit.refresh": "Refresh",
  "admin-a.audit.reportedByBot": ", reported by the Bot itself",
  "admin-a.audit.routedByPerson": "The person chose this Bot",
  "admin-a.audit.routedFallback": "Sent to the default Bot",
  "admin-a.audit.routedMatched": "Sent to the Bot it is for",
  "admin-a.audit.title": "Audit",
  "admin-a.audit.toolsOffered": "{offered} of {granted} tools",
  "admin-a.bot-grant-picker.countOne": "{held} of {total} Bot",
  "admin-a.bot-grant-picker.countOther": "{held} of {total} Bots",
  "admin-a.bot-grant-picker.groupCount": "{held} of {total}",
  "admin-a.bot-grant-picker.noMatch": "No Bot matches “{query}”.",
  "admin-a.bot-grant-picker.noWorkspace": "No workspace",
  "admin-a.bot-grant-picker.searchAria": "Search Bots",
  "admin-a.bot-grant-picker.searchPlaceholder": "Search Bots…",
  "admin-a.boundaries.addRule": "Add rule",
  "admin-a.boundaries.allowDescription":
    "The floor, applied to anything the deny list did not catch. It is not a formality: an empty list here permits nothing, so a deployment that clears this refuses every action rather than allowing every action.",
  "admin-a.boundaries.allowTitle": "Otherwise it may",
  "admin-a.boundaries.allowTrue": "true, anything not refused above",
  "admin-a.boundaries.auditLink": "Audit",
  "admin-a.boundaries.computersOff":
    "Computers are switched off in this deployment, so there is nothing to bound here.",
  "admin-a.boundaries.denyDescription":
    "Checked first, and a match ends it: nothing below is consulted and the Bot is told which rule refused it. Rules are CEL, and can ask about `tool.name`, `intent`, `bot.id`, `actor.id`, `page.url` and `page.host`, the element being acted on, the `key` being pressed, the file being touched, the `command` being run, and `mcp.server`, `mcp.tool` and `mcp.effect` for a call to somebody else’s tools. A rule that cannot be evaluated counts as a match, so a mistyped deny refuses rather than quietly permitting what it was meant to forbid.",
  "admin-a.boundaries.denyTitle": "It may never",
  "admin-a.boundaries.descriptionAfter": "with the rule that refused it.",
  "admin-a.boundaries.descriptionBefore":
    "What every Bot may and may not do with its computer. Rules are checked on every action before it happens, and a refusal is recorded in",
  "admin-a.boundaries.modeDescription":
    "Enforce stops the action. Record it and allow it writes the same row and lets the action through, which is how a rule is tried on real traffic before it starts refusing anybody.",
  "admin-a.boundaries.modeDryRun": "Record it and allow it",
  "admin-a.boundaries.modeDryRunNote":
    "Nothing is stopped. Every action a rule matches is recorded as it would have been refused, which is how a rule is tried out before it is switched on.",
  "admin-a.boundaries.modeEnforce": "Stop the action",
  "admin-a.boundaries.modeEnforceNote":
    "The Bot is stopped and told which rule refused it.",
  "admin-a.boundaries.modeTitle": "When a rule matches",
  "admin-a.boundaries.noActions":
    "No recorded computer actions to test against yet. The rule is valid; what it matches will only be known once Bots have acted.",
  "admin-a.boundaries.noRules":
    "No rules. Every action is allowed and recorded.",
  "admin-a.boundaries.onElement": "on “{name}”",
  "admin-a.boundaries.presetNoPasswordCost":
    "A password box the page labels something else is not covered, the rule matches the label.",
  "admin-a.boundaries.presetNoPasswordLabel":
    "Never type into a password field",
  "admin-a.boundaries.presetNoSocialCost":
    "Only the two hosts named. A link that redirects there from somewhere else is allowed.",
  "admin-a.boundaries.presetNoSocialLabel": "Stay off social media",
  "admin-a.boundaries.presetNoSubmitCost":
    "Also stops the Bot pressing Enter for anything else, because a form submits from Enter in any of its fields.",
  "admin-a.boundaries.presetNoSubmitLabel": "Never submit a form",
  "admin-a.boundaries.remove": "Remove",
  "admin-a.boundaries.ruleAriaLabel": "A rule, written in CEL",
  "admin-a.boundaries.running": "running",
  "admin-a.boundaries.saved":
    "Saved. It applies to the next action any Bot takes.",
  "admin-a.boundaries.showingFirst":
    "Showing the first {count}; the count above covers everything scanned.",
  "admin-a.boundaries.testFirst": "Test first",
  "admin-a.boundaries.testedNone":
    "Tested against the last {scanned} recorded actions: this rule would have refused none of them. It may still match future actions.",
  "admin-a.boundaries.testedSome":
    "Tested against the last {scanned} recorded actions: this rule would have refused {wouldRefuse}.",
  "admin-a.boundaries.testing": "Testing…",
  "admin-a.boundaries.title": "Boundaries",
  "admin-a.boundaries.touching": "touching {file}",
  "admin-a.boundaries.unsavedNote":
    "Changes apply to the next action any Bot takes, and are kept: a restart comes back up enforcing what is here.",
  "admin-a.boundaries.workspacesDescription":
    "Every workspace starts with one rule: a tool that changes something waits for a person. The Bot asks, the person answers on a card in the channel, and the same call goes through once. Reads never wait.",
  "admin-a.boundaries.workspacesTitle": "Workspaces",
  "admin-a.boundaries.wouldAllow": "Would now allow",
  "admin-a.boundaries.wouldRefuse": "Would refuse",
  "admin-a.computers.auditLink": "Audit",
  "admin-a.computers.cancel": "Cancel",
  "admin-a.computers.description":
    "Each Bot's browser and the profile it keeps. A profile is what makes a Bot still signed in tomorrow, and resetting one signs it out of everything.",
  "admin-a.computers.egressDirect": "Leaves directly",
  "admin-a.computers.egressUnknown": "Egress not reported",
  "admin-a.computers.egressVia": "Leaves through {egress}",
  "admin-a.computers.empty":
    "No computers yet. One appears the first time a Bot opens a page.",
  "admin-a.computers.helpAfter": ".",
  "admin-a.computers.helpReset": "Reset",
  "admin-a.computers.helpResetText":
    "deletes the profile, so the Bot is signed out of everything and starts clean. Both are recorded in",
  "admin-a.computers.helpStop": "Stop",
  "admin-a.computers.helpStopText":
    "closes the browser and keeps its logins: the next thing the Bot does starts it again where it left off.",
  "admin-a.computers.listFailed": "The computers could not be listed.",
  "admin-a.computers.notRunning":
    "No browser running. It starts when the Bot next needs it.",
  "admin-a.computers.off": "Computers are switched off in this deployment.",
  "admin-a.computers.perBot":
    "Each Bot has a computer of its own: its own container, its own files and its own browser profile.",
  "admin-a.computers.reset": "Reset",
  "admin-a.computers.resetDescription":
    "Its profile is deleted, so the Bot is signed out of every service it had logged into and starts clean. This cannot be undone.",
  "admin-a.computers.resetIt": "Reset it",
  "admin-a.computers.resetTitle": "Reset {name}'s computer?",
  "admin-a.computers.resetting": "Resetting…",
  "admin-a.computers.runningSince": "Browser running since {time}",
  "admin-a.computers.sectionTitle": "Computers in this deployment",
  "admin-a.computers.sharedText":
    "They share its logins, its files and its session, so a Bot can reach what another signed into. Set `COMPUTER_SUPERVISOR_URL` to give each Bot its own.",
  "admin-a.computers.sharedTitle": "Every Bot is sharing one computer.",
  "admin-a.computers.stopBrowser": "Stop browser",
  "admin-a.computers.title": "Computers",
  "admin-a.computers.working": "Working…",
  "admin-a.credentials.addCredential": "Add credential",
  "admin-a.credentials.cancel": "Cancel",
  "admin-a.credentials.description":
    "Credentials are write-only. Bots never displays their secret values.",
  "admin-a.credentials.dialogDescription":
    "Held for this deployment and never shown again once saved.",
  "admin-a.credentials.keyIdLabel": "Key ID",
  "admin-a.credentials.keyIdPlaceholder": "production",
  "admin-a.credentials.kindConnector": "Connector",
  "admin-a.credentials.kindLabel": "Type",
  "admin-a.credentials.kindModel": "Model",
  "admin-a.credentials.loadFailed": "Could not load credentials.",
  "admin-a.credentials.none": "No credentials are configured.",
  "admin-a.credentials.noneActive": "No active credentials.",
  "admin-a.credentials.providerLabel": "Provider",
  "admin-a.credentials.replaceWarning":
    "This key already holds a live credential. Saving replaces it, and the one it replaces is revoked.",
  "admin-a.credentials.revoke": "Revoke",
  "admin-a.credentials.revoked": "revoked",
  "admin-a.credentials.revokedCountOne": "{count} revoked credential",
  "admin-a.credentials.revokedCountOther": "{count} revoked credentials",
  "admin-a.credentials.revokedOn": "revoked {date}",
  "admin-a.credentials.save": "Save credential",
  "admin-a.credentials.saveFailed": "Could not save the credential. Try again.",
  "admin-a.credentials.saving": "Saving…",
  "admin-a.credentials.secretLabel": "Secret",
  "admin-a.credentials.sectionTitle": "Configured credentials",
  "admin-a.credentials.title": "Credentials",
  "admin-a.index.description":
    "Settings that apply to everybody in this deployment. Anything here affects every person and every Bot, which is what separates it from your own preferences.",
  "admin-a.index.title": "Admin",
  "admin-a.models.chooseModelAfter": ".",
  "admin-a.models.chooseModelBefore":
    "Choose which model each workspace runs on under",
  "admin-a.models.description":
    "Gemini on Vertex AI runs on this server's own Google credentials and needs no key. Every other provider needs an API key. A workspace without a key of its own uses the ones here; pick the model per workspace under Workspaces.",
  "admin-a.models.subscriptionNote":
    "A subscription is not a key: Claude Max and Gemini CLI sign a person in on their own laptop and cannot be used from a server. Bots here run on API access, billed per use by the provider. Keys are sealed with this deployment's encryption key and never shown again; only the last four characters are.",
  "admin-a.models.title": "Models",
  "admin-a.models.workspacesLink": "Workspaces",
  "admin-a.people.accessRemoved": "Access removed · {providers}",
  "admin-a.people.adminByConfig": "Administrator by configuration · {when}",
  "admin-a.people.description":
    "Everybody who has signed in. Administrators reach these screens; everybody else talks to Bots.",
  "admin-a.people.empty":
    "Nobody has signed in yet. People appear here once they do.",
  "admin-a.people.lastSignedIn": "last signed in {date}",
  "admin-a.people.loadFailed": "Could not load people.",
  "admin-a.people.loading": "Loading…",
  "admin-a.people.neverSignedIn": "never signed in",
  "admin-a.people.noMatch": 'Nobody here matches "{query}".',
  "admin-a.people.noProvider": "no provider",
  "admin-a.people.providerWhen": "{providers} · {when}",
  "admin-a.people.remove": "Remove",
  "admin-a.people.restore": "Restore",
  "admin-a.people.searchAria": "Search people",
  "admin-a.people.searchPlaceholder": "Search by name or address",
  "admin-a.people.sectionDescription":
    "Who is an administrator is decided in NOTOS (Team), not here. Remove blocks an address in Bots even while NOTOS still lets it in.",
  "admin-a.people.sectionTitle": "Who is here",
  "admin-a.people.showMore": "Show more",
  "admin-a.people.title": "People",
  "admin-a.playground.argumentsLabel": "Arguments (JSON Schema)",
  "admin-a.playground.cancel": "Cancel",
  "admin-a.playground.delete": "Delete",
  "admin-a.playground.deleteDescription":
    "It is removed from this deployment. Any Bot that could draw it no longer can, and this cannot be undone.",
  "admin-a.playground.deleteIt": "Delete it",
  "admin-a.playground.deleteTitle": "Delete {name}?",
  "admin-a.playground.description":
    "Write a component here and publish it without a deployment. What you edit is a draft; a conversation only ever draws what is published.",
  "admin-a.playground.descriptionLabel": "What the model is told about it",
  "admin-a.playground.descriptionPlaceholder":
    "Show a refund with its amount, reason and status.",
  "admin-a.playground.draftOnly": "draft only, no Bot can draw it",
  "admin-a.playground.editedSince": " · edited since publishing",
  "admin-a.playground.invalidSample":
    "The sample arguments are not valid JSON, so there is nothing to draw with.",
  "admin-a.playground.nameLabel": "Name",
  "admin-a.playground.notValidJson": "not valid JSON",
  "admin-a.playground.nothingYet": "Nothing yet.",
  "admin-a.playground.open": "Open",
  "admin-a.playground.preview": "Preview",
  "admin-a.playground.publish": "Publish",
  "admin-a.playground.publishNote":
    "Publishing makes it available to every Bot. Switch it off for a particular Bot on the Components page, the same as for a component this build ships.",
  "admin-a.playground.publishedRevision": "published, revision {revision}",
  "admin-a.playground.sampleLabel": "Sample arguments",
  "admin-a.playground.saveDraft": "Save draft",
  "admin-a.playground.savedHere": "Saved here",
  "admin-a.playground.title": "Playground",
  "admin-a.playground.titleLabel": "Title",
  "admin-a.playground.titlePlaceholder": "Refund card",
  "admin-a.modelUsage.cached": "From cache",
  "admin-a.modelUsage.calls": "Calls",
  "admin-a.modelUsage.description":
    "Tokens, not euros: what a model costs depends on the rate at the moment of the call, and that rate is not kept here. Multiply these by the rate you pay.",
  "admin-a.modelUsage.empty": "No model has run in the past {days} days.",
  "admin-a.modelUsage.input": "Input",
  "admin-a.modelUsage.lastUsed": "Last used",
  "admin-a.modelUsage.loadFailed": "Could not read what the models used.",
  "admin-a.modelUsage.model": "Model",
  "admin-a.modelUsage.output": "Output",
  "admin-a.modelUsage.title": "What the models used",
};

export default adminUa;
