// NOTOS i18n: admin-b (en). Keys: "admin-b.<file>.<name>". Add keys in both languages.
const adminUb: Record<string, string> = {
  "admin-b.component.allBots": "All {count} Bots",
  "admin-b.component.availableTo": "Available to",
  "admin-b.component.back": "UI Components",
  "admin-b.component.backToComponents": "Back to components",
  "admin-b.component.by": "by {name}",
  "admin-b.component.calledAs": "Called as",
  "admin-b.component.cancel": "Cancel",
  "admin-b.component.configuration": "Configuration",
  "admin-b.component.configurationDescription":
    "What this component is for, and which Bots are allowed to answer with it.",
  "admin-b.component.descriptionDialogDescription":
    "What the model reads when deciding to call this. It changes nothing until the component is published.",
  "admin-b.component.descriptionLabel": "Description",
  "admin-b.component.details": "Details",
  "admin-b.component.done": "Done",
  "admin-b.component.errorTitle": "Components",
  "admin-b.component.functionsDialogDescription":
    "A separate grant from Available to, and not implied by it: that one decides who may draw this, and this decides what it may go and fetch in order to draw itself. Until one of these is on it shows only what the Bot passes it, and every read it does make is a row in Audit. Each change takes effect immediately.",
  "admin-b.component.grantsDialogDescription":
    "Switch a Bot off and it is never told this component exists, so it cannot ask for it and does not apologise for not having it. Each change takes effect immediately.",
  "admin-b.component.kind": "Kind",
  "admin-b.component.lastChanged": "Last changed",
  "admin-b.component.loadFailed": "Could not load components.",
  "admin-b.component.mayRead": "May read",
  "admin-b.component.noBots": "No Bots",
  "admin-b.component.noBotsYet": "There are no Bots yet",
  "admin-b.component.noBotsYetSentence": "There are no Bots yet.",
  "admin-b.component.noDataFunctions":
    "This deployment grants no data functions",
  "admin-b.component.noDataFunctionsSentence":
    "This deployment grants no data functions.",
  "admin-b.component.noFunctionsHeld":
    "Nothing — it draws only what the model hands it",
  "admin-b.component.notFoundDescription": "Nothing here answers to that name.",
  "admin-b.component.notFoundHint":
    "It may have been renamed, or this deployment may no longer ship it.",
  "admin-b.component.notFoundTitle": "No such component",
  "admin-b.component.notInBuild": "Not in this build",
  "admin-b.component.notInBuildDescription":
    "Nothing here can draw it, whatever else is set.",
  "admin-b.component.nothingPublished":
    "Nothing is published, so no Bot is told about this.",
  "admin-b.component.nothingYet": "Nothing yet",
  "admin-b.component.published": "Published",
  "admin-b.component.publishedOff": "No Bot may use it.",
  "admin-b.component.publishedOn": "Bots may answer with it.",
  "admin-b.component.save": "Save",
  "admin-b.component.someBots": "{granted} of {total} Bots",
  "admin-b.component.unpublishedChanges":
    "The description has changes that are not published.",
  "admin-b.components.description":
    "What each Bot may answer with. Every published component is available to every Bot; switch one off here and that Bot is never told about it. Each change and each refusal is a row in Audit.",
  "admin-b.components.emptyDescription":
    "Components that your Agents can use will be shown here.",
  "admin-b.components.emptyTitle": "No components yet",
  "admin-b.components.loadFailed": "Could not load components.",
  "admin-b.components.title": "UI Components",
  "admin-b.plugin.accessToken": "Access token",
  "admin-b.plugin.accessTokenDescription":
    "Sent as a bearer token on every call to this vendor.",
  "admin-b.plugin.accessTokenDialogDescription":
    "Stored in this deployment's vault and never read back.",
  "admin-b.plugin.accessTokenFor": "Access token for {title}",
  "admin-b.plugin.allBots": "All Bots",
  "admin-b.plugin.back": "Plugins",
  "admin-b.plugin.builtIn": "Built in",
  "admin-b.plugin.builtinDescription":
    "Nothing to configure. These tools run inside this deployment, on the tables it already owns.",
  "admin-b.plugin.cancel": "Cancel",
  "admin-b.plugin.changesThings": "changes things",
  "admin-b.plugin.changesThingsHeading": "Changes things",
  "admin-b.plugin.clientId": "Client ID",
  "admin-b.plugin.clientSecret": "Client secret",
  "admin-b.plugin.connect": "Connect",
  "admin-b.plugin.connected": "Connected",
  "admin-b.plugin.connection": "Connection",
  "admin-b.plugin.connectionBearerDescription":
    "What this deployment presents to the vendor. One credential, used for everybody.",
  "admin-b.plugin.connectionBuiltinDescription":
    "Built into this deployment. There is no vendor to reach and no credential to hold — a call runs as whoever asked.",
  "admin-b.plugin.connectionOauthDescription":
    "This vendor answers as whoever is asking. The deployment registers an OAuth client, and each person connects their own account, so a Bot only ever sees what that person can see.",
  "admin-b.plugin.disableBotsOne": "{count} Bot",
  "admin-b.plugin.disableBotsOther": "{count} Bots",
  "admin-b.plugin.disableConfirm": "Switch it off",
  "admin-b.plugin.disableGrantsOne": "{count} grant",
  "admin-b.plugin.disableGrantsOther": "{count} grants",
  "admin-b.plugin.disableLossOne":
    "{grants} across {bots} goes with it, and switching it back on does not bring them back.",
  "admin-b.plugin.disableLossOther":
    "{grants} across {bots} go with it, and switching it back on does not bring them back.",
  "admin-b.plugin.disableNothingLost":
    "No Bot holds any of its tools yet, so nothing else is lost.",
  "admin-b.plugin.disableTitle": "Switch off {title} for this deployment?",
  "admin-b.plugin.disabledDescription":
    "No Bot can reach this vendor. Switch it on to configure it and grant its tools.",
  "admin-b.plugin.documentation": "Documentation",
  "admin-b.plugin.documentationDescription":
    "What these tools offer, from the people who maintain them.",
  "admin-b.plugin.enable": "Enable for this deployment",
  "admin-b.plugin.enableLabel": "Enable {title} for this deployment",
  "admin-b.plugin.enabledDescription":
    "Bots may be granted its tools. Switching this off removes it and every grant on its tools.",
  "admin-b.plugin.grant": "Grant",
  "admin-b.plugin.grantDialogDescription":
    "Each grant is its own entry on the audit trail, and a granted write is still checked against the boundaries on every call.",
  "admin-b.plugin.grantDialogTitle": "Grant tools",
  "admin-b.plugin.grantSummarySentence": "Grant {tools}{writes} to {names}.",
  "admin-b.plugin.grantSummaryToolsOne": "{count} tool",
  "admin-b.plugin.grantSummaryToolsOther": "{count} tools",
  "admin-b.plugin.grantSummaryWritesOne": ", {count} of which changes things,",
  "admin-b.plugin.grantSummaryWritesOther": ", {count} of which change things,",
  "admin-b.plugin.grantTo": "To",
  "admin-b.plugin.grantTools": "Grant tools…",
  "admin-b.plugin.granting": "Granting {done} of {total}…",
  "admin-b.plugin.held": "Held",
  "admin-b.plugin.instanceHost": "Instance host",
  "admin-b.plugin.instanceHostDescription":
    "This vendor gives every customer their own hostname, checked against its pattern before anything is stored.",
  "admin-b.plugin.instanceHostDialogDescription":
    "Your own hostname with this vendor. It is checked against their pattern before anything is stored.",
  "admin-b.plugin.instanceHostFor": "Instance host for {title}",
  "admin-b.plugin.instanceHostPlaceholder":
    "https://your-instance.service-now.com",
  "admin-b.plugin.noBots": "No Bots",
  "admin-b.plugin.noPublicUrl":
    "This deployment has no public URL, so nobody can complete a consent flow. Set OPENBOT_PUBLIC_URL.",
  "admin-b.plugin.notFoundDescription":
    "This deployment does not have a plugin by that name, and the catalogue does not offer one.",
  "admin-b.plugin.notFoundEmpty": "Nothing to configure.",
  "admin-b.plugin.notFoundTitle": "Not a plugin",
  "admin-b.plugin.notListedBy": "Not listed by {title}.",
  "admin-b.plugin.notListedByAsOf":
    "Not listed by {title} as of the last refresh.",
  "admin-b.plugin.notRegistered": "Not registered",
  "admin-b.plugin.notSet": "Not set",
  "admin-b.plugin.oauthClient": "OAuth client",
  "admin-b.plugin.oauthClientDescription":
    "Identifies this deployment to the vendor. It reaches nobody's documents on its own.",
  "admin-b.plugin.oauthClientDialogDescription":
    "From the vendor's console. The secret is stored in this deployment's vault and never read back.",
  "admin-b.plugin.oauthClientDynamicDescription":
    "This deployment registers itself with the vendor on first connect. There is nothing to paste.",
  "admin-b.plugin.oauthClientFor": "OAuth client for {title}",
  "admin-b.plugin.oneBot": "1 Bot",
  "admin-b.plugin.pendingTitle": "Plugin",
  "admin-b.plugin.reads": "reads",
  "admin-b.plugin.readsHeading": "Reads",
  "admin-b.plugin.redirectDynamic":
    "The deployment registers its redirect URI itself, so there is nothing to add at the vendor.",
  "admin-b.plugin.redirectInstruction":
    "Add this to the client's authorised redirect URIs at the vendor, exactly as written. A single wrong character fails there, with a message that does not mention OpenBot.",
  "admin-b.plugin.refreshTools": "Refresh tools",
  "admin-b.plugin.registered": "Registered",
  "admin-b.plugin.save": "Save",
  "admin-b.plugin.selectAll": "Select all",
  "admin-b.plugin.selfRegistered": "Self-registered",
  "admin-b.plugin.someBots": "{held} of {total} Bots",
  "admin-b.plugin.tools": "Tools",
  "admin-b.plugin.toolsDescription":
    "A Bot is told about a tool only when it holds it. Every call is decided again when it happens, so removing a grant takes effect on the next one.",
  "admin-b.plugin.toolsEmpty":
    "No tools listed. Refresh to ask the vendor again.",
  "admin-b.plugin.vendorDocumentation": "Vendor documentation",
  "admin-b.plugin.vendorDocumentationDescription":
    "What this server offers, from the people who maintain it.",
  "admin-b.plugin.withdrawn": "Held but not offered",
  "admin-b.plugin.withdrawnDescription":
    "This vendor no longer lists these, so no Bot is told about them and no model can call one. The grant is still recorded, and the tool would be offered again if the vendor started listing it. Revoke from the Bot's own page if that is not what you want.",
  "admin-b.plugin.yourAccount": "Your account",
  "admin-b.plugin.yourAccountConnected":
    "Connected, so a Bot granted these tools uses your {title} as you. Everybody else connects their own.",
  "admin-b.plugin.yourAccountDescription":
    "Connect your own account to try this connector. Setup is complete without it, and it reaches your documents only.",
  "admin-b.pluginTool.backFallback": "Plugin",
  "admin-b.pluginTool.bots": "Bots",
  "admin-b.pluginTool.botsDescription":
    "A Bot may call this tool only while its switch is on. Turning one off takes effect on the next call, with nothing cached in between. Every call is still checked against the boundaries and written to the audit trail.",
  "admin-b.pluginTool.cannotCallBack": "cannot call back",
  "admin-b.pluginTool.changesThings": "changes things",
  "admin-b.pluginTool.connectorDisabled":
    "This deployment has not enabled that connector.",
  "admin-b.pluginTool.effect": "Effect",
  "admin-b.pluginTool.effectDescription":
    "Decided by the connector, not by the tool's name. Anything unrecognised counts as a write.",
  "admin-b.pluginTool.letCall": "Let {name} call {tool}",
  "admin-b.pluginTool.noBots":
    "This deployment has no Bots yet, so there is nobody to grant this to.",
  "admin-b.pluginTool.noDescription": "This tool came with no description.",
  "admin-b.pluginTool.notFoundDescription":
    "This connector does not advertise a tool by that name.",
  "admin-b.pluginTool.pendingTitle": "Tool",
  "admin-b.pluginTool.readDescription":
    "This tool only reads. A boundary written about writes does not apply to it.",
  "admin-b.pluginTool.reads": "reads",
  "admin-b.pluginTool.stuckExplanation":
    "They have no credential for calling tools back, so every call is refused before it reaches the boundary. Issue one on each Bot's own page, or set",
  "admin-b.pluginTool.stuckExplanationTail": "for the deployment.",
  "admin-b.pluginTool.stuckOne":
    "{count} Bot holds this tool but cannot call it yet.",
  "admin-b.pluginTool.stuckOther":
    "{count} Bots hold this tool but cannot call it yet.",
  "admin-b.pluginTool.whatItDoes": "What it does",
  "admin-b.pluginTool.withdrawn":
    "It may have been withdrawn since the tool list was last refreshed.",
  "admin-b.pluginTool.writeDescription":
    "This tool changes something at the vendor. A boundary written about writes applies to it, and it is refused when one matches.",
  "admin-b.plugins.added": "Added",
  "admin-b.plugins.addedDescription":
    "Added for the whole deployment. Open one to set what it needs and which Bots hold its tools.",
  "admin-b.plugins.addedEmpty":
    "Nothing added yet. Everything available is below.",
  "admin-b.plugins.botsOne": "{count} Bot",
  "admin-b.plugins.botsOther": "{count} Bots",
  "admin-b.plugins.connectYourAccount": "connect your account",
  "admin-b.plugins.description":
    "What this deployment can reach, and which Bots may reach it. Adding a plugin is account-wide; which Bots hold its tools is decided on its own page.",
  "admin-b.plugins.explore": "Explore plugins",
  "admin-b.plugins.exploreDescription":
    "Reviewed, first-party servers this build will talk to. Open one to add it.",
  "admin-b.plugins.exploreEmpty": "Everything in the catalogue is added.",
  "admin-b.plugins.loadFailed": "Plugins could not be loaded.",
  "admin-b.plugins.noBots": "no Bots",
  "admin-b.plugins.noToolsYet": "No tools yet",
  "admin-b.plugins.notAdded": "Not added",
  "admin-b.plugins.title": "Plugins",
  "admin-b.plugins.toolsOne": "{count} tool",
  "admin-b.plugins.toolsOther": "{count} tools",
  "admin-b.plugins.yourAccountConnected": "your account connected",
  "admin-b.skills.cancel": "Cancel",
  "admin-b.skills.description":
    "Named instructions anybody here can invoke with a slash. A skill adds no capability: it can only ask a Bot to use what that Bot already holds, and every one of those calls is still decided and recorded.",
  "admin-b.skills.done": "Done",
  "admin-b.skills.empty": "No skills yet.",
  "admin-b.skills.giveLabel": "Give {name} /{slug}",
  "admin-b.skills.grantedNone": "There are no Bots yet",
  "admin-b.skills.grantedToAllOne": "Granted to all {total} Bot",
  "admin-b.skills.grantedToAllOther": "Granted to all {total} Bots",
  "admin-b.skills.grantedToNone": "Granted to no Bots",
  "admin-b.skills.grantedToSome": "Granted to {held} of {total} Bots",
  "admin-b.skills.install": "Install skill",
  "admin-b.skills.installed": "Installed",
  "admin-b.skills.installedDescription":
    "Written for the whole deployment. People write their own on their Skills page.",
  "admin-b.skills.instructions": "Instructions",
  "admin-b.skills.instructionsPlaceholder":
    "What the Bot should do when this skill is used.",
  "admin-b.skills.manage": "Manage",
  "admin-b.skills.noBots": "There are no Bots yet.",
  "admin-b.skills.remove": "Remove",
  "admin-b.skills.removeDescription":
    "Every Bot loses it, and anybody who types /{slug} gets nothing. This cannot be undone.",
  "admin-b.skills.removeTitle": "Remove /{slug} for the whole deployment?",
  "admin-b.skills.slug": "Slug",
  "admin-b.skills.slugPlaceholder": "standup-notes",
  "admin-b.skills.summary": "Summary",
  "admin-b.skills.summaryPlaceholder": "One line",
  "admin-b.skills.title": "Skills",
  "admin-b.skills.titleLabel": "Title",
  "admin-b.skills.titlePlaceholder": "Title",
  "admin-b.skills.whoHas": "Who has /{slug}",
  "admin-b.skills.whoHasDescription":
    "A Bot with its switch on is handed these instructions when somebody types the slash. Each change takes effect immediately.",
  "admin-b.skills.write": "Write a skill",
  "admin-b.skills.writeDescription":
    "The slug is what a person types after a slash, and the instructions are added to the run when they do. Everybody here can use it, and you decide which Bots have it.",
  "admin-b.skills.writeTitle": "Write a skill for the deployment",
  "admin-b.workspaces.add": "Add",
  "admin-b.workspaces.cancel": "Cancel",
  "admin-b.workspaces.demoSuffix": "(demo)",
  "admin-b.workspaces.description":
    "Every NOTOS client is a workspace. The model stays in the EU by default; global is a deliberate choice per workspace, because that traffic leaves the EU.",
  "admin-b.workspaces.driveFolderLinks": "Drive folder links",
  "admin-b.workspaces.driveFolderPlaceholder":
    "https://drive.google.com/drive/folders/…",
  "admin-b.workspaces.driveFoldersOne": "Drive: {count} folder",
  "admin-b.workspaces.driveFoldersOther": "Drive: {count} folders",
  "admin-b.workspaces.emailAddress": "Email address",
  "admin-b.workspaces.emailPlaceholder": "name@company.com",
  "admin-b.workspaces.empty":
    "No workspaces yet: the NOTOS sync has not fetched anything.",
  "admin-b.workspaces.hideMembers": "Hide members",
  "admin-b.workspaces.loadFailed": "The workspaces could not be loaded.",
  "admin-b.workspaces.loading": "Loading…",
  "admin-b.workspaces.members": "Members ({count})",
  "admin-b.workspaces.modelFor": "Model for {name}",
  "admin-b.workspaces.noDriveFolder": "No Drive folder",
  "admin-b.workspaces.noMembers":
    "Nobody added here yet. People NOTOS already lets in keep their access.",
  "admin-b.workspaces.ownSetting": "Own setting",
  "admin-b.workspaces.ownSettingDetail": "{model} on {where} (own setting)",
  "admin-b.workspaces.remove": "Remove",
  "admin-b.workspaces.role": "Role",
  "admin-b.workspaces.save": "Save",
  "admin-b.workspaces.title": "Workspaces",
};

export default adminUb;
