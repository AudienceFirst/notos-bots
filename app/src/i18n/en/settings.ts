// NOTOS i18n: settings (en). Keys: "settings.<file>.<name>". Add keys in both languages.
const settings: Record<string, string> = {
  "settings.componentsGallery.description":
    "The pieces a Bot can draw in a conversation instead of describing something in prose. Which of them any one Bot may use is an administrator's decision.",
  "settings.componentsGallery.emptyDescription":
    "When an administrator publishes a component, it will show up here.",
  "settings.componentsGallery.emptyTitle": "Nothing published yet",
  "settings.componentsGallery.loadFailed": "Could not load components.",
  "settings.componentsGallery.title": "Components gallery",
  "settings.componentsGalleryDetail.backLabel": "Components gallery",
  "settings.componentsGalleryDetail.backToGallery": "Back to the gallery",
  "settings.componentsGalleryDetail.calledAs": "Called as",
  "settings.componentsGalleryDetail.details": "Details",
  "settings.componentsGalleryDetail.kind": "Kind",
  "settings.componentsGalleryDetail.loadFailed": "Could not load components.",
  "settings.componentsGalleryDetail.noSuchDescription":
    "Nothing here answers to that name.",
  "settings.componentsGalleryDetail.noSuchTitle": "No such component",
  "settings.componentsGalleryDetail.withdrawn":
    "It may have been withdrawn, or this deployment may no longer ship it.",
  "settings.connectedAccount.accessDescription":
    "What you agreed to, as the vendor recorded it — not what was asked for. The two differ when a consent screen is only partly accepted.",
  "settings.connectedAccount.accessTitle": "Access",
  "settings.connectedAccount.account": "Account",
  "settings.connectedAccount.backLabel": "Connected accounts",
  "settings.connectedAccount.connect": "Connect",
  "settings.connectedAccount.connected": "Connected",
  "settings.connectedAccount.disconnect": "Disconnect your {title} account",
  "settings.connectedAccount.disconnectNotice":
    "Disconnecting is not built yet. Until it is, revoke it in your {vendor} account's third-party access settings — that stops this deployment reading anything immediately.",
  "settings.connectedAccount.granted": "Granted",
  "settings.connectedAccount.noScope": "The vendor named no scope.",
  "settings.connectedAccount.nobodyReads":
    "No Bot can read this as you. Connecting takes you to the vendor to consent.",
  "settings.connectedAccount.notEnabled":
    "An administrator has not enabled this connector, so there is nothing to connect to yet.",
  "settings.connectedAccount.notYoursDescription":
    "This is not a service you connect for yourself.",
  "settings.connectedAccount.readsAsYou":
    "A Bot granted its tools reads this as you, and sees only what you can see.",
  "settings.connectedAccount.sharedCredential":
    "A Bot reaches this one with a credential the deployment holds, the same for everybody.",
  "settings.connectedAccount.unknown":
    "This deployment has no connector by that name.",
  "settings.connectedAccount.yourAccount": "Your account",
  "settings.connectedAccounts.connectFailed":
    "That account could not be connected. Nothing was saved — try again.",
  "settings.connectedAccounts.connected": "Connected",
  "settings.connectedAccounts.description":
    "Services a Bot reads as you, so it only ever sees what you can see. Connecting is yours to grant, and nobody can grant it for you.",
  "settings.connectedAccounts.empty":
    "Nothing to connect yet. These appear once an administrator enables a connector that reads as the person asking.",
  "settings.connectedAccounts.loadFailed":
    "Your connected accounts could not be loaded.",
  "settings.connectedAccounts.notConnected": "Not connected",
  "settings.connectedAccounts.title": "Connected accounts",
  "settings.home.noWorkspace":
    "You have no workspace yet. Ask ZUID to add you to a client in NOTOS under Settings › Access.",
  "settings.index.darkTheme": "Dark theme",
  "settings.index.darkThemeDescription": "Use the dark appearance across Bots.",
  "settings.index.description":
    "How Bots looks and behaves for you. These apply to your account alone, on every deployment you sign in to.",
  "settings.index.general": "General",
  "settings.index.shortcuts": "Keyboard shortcuts",
  "settings.index.title": "Preferences",
  "settings.modelKeysPanel.addKey": "Add key",
  "settings.modelKeysPanel.apiKeyLabel": "{provider} API key",
  "settings.modelKeysPanel.close": "Close",
  "settings.modelKeysPanel.getOneAt": "Get one at",
  "settings.modelKeysPanel.keySet": "Key {hint} · set {date}",
  "settings.modelKeysPanel.keySetWithLabel":
    "Key {hint} · {label} · set {date}",
  "settings.modelKeysPanel.label": "Label",
  "settings.modelKeysPanel.labelPlaceholder": "Label (optional)",
  "settings.modelKeysPanel.loadFailed": "The keys could not be loaded.",
  "settings.modelKeysPanel.noKey": "No key yet",
  "settings.modelKeysPanel.off": "Off",
  "settings.modelKeysPanel.ready": "Ready",
  "settings.modelKeysPanel.remove": "Remove",
  "settings.modelKeysPanel.replace": "Replace",
  "settings.modelKeysPanel.save": "Save",
  "settings.modelKeysPanel.startsWith": "It starts with {prefix}",
  "settings.modelPicker.heading": "Model for this conversation",
  "settings.modelPicker.keyedHint":
    "Claude, GPT and OpenRouter appear here once a key is set under Models.",
  "settings.modelPicker.model": "Model",
  "settings.modelPicker.triggerLabel": "Model for this conversation: {label}",
  "settings.modelPicker.workspaceModel": "Workspace model",
  "settings.models.anotherModel": "Another model (type its id)…",
  "settings.models.custom": "Custom: {provider} · {model}",
  "settings.models.description":
    "Your personal space runs on the model you choose here, with your own keys. Nobody else sees your space, and your keys serve your space only.",
  "settings.models.keysExplanation":
    "A subscription is not a key: Claude Max and Gemini CLI sign you in on your own laptop and cannot be used from a server. Bots run on API access, billed per use by the provider. Without a key of your own, your space uses the deployment's keys where an administrator set them.",
  "settings.models.loadFailed": "Your model choice could not be loaded.",
  "settings.models.modelId": "Model id",
  "settings.models.modelIdPlaceholder":
    "e.g. anthropic/claude-sonnet-5 on OpenRouter",
  "settings.models.provider": "Provider",
  "settings.models.runsOn": "Your personal space runs on",
  "settings.models.save": "Save",
  "settings.models.selectLabel": "Model for your personal space",
  "settings.models.title": "Models",
  "settings.models.yourKeys": "Your keys",
  "settings.onboarding.back": "Back",
  "settings.onboarding.composerExample": "Hand off tasks to your team of Bots",
  "settings.onboarding.computerTitle": "Each agent has its own computer",
  "settings.onboarding.continue": "Continue",
  "settings.onboarding.example": "Example",
  "settings.onboarding.getStarted": "Get started",
  "settings.onboarding.placeholderData": "Data Analyst",
  "settings.onboarding.placeholderResearch": "Research Analyst",
  "settings.onboarding.placeholderSupport": "Support Bot",
  "settings.onboarding.rosterTitle":
    "Choose from a variety of agents or create your own",
  "settings.onboarding.saving": "Saving…",
  "settings.onboarding.welcomeTitle": "Welcome to {product}",
  "settings.onboarding.yourOwn": "Your own agent",
  "settings.settingsSidebar.backToApp": "Back to app",
  "settings.settingsSidebar.componentsGallery": "Components gallery",
  "settings.settingsSidebar.connectedAccounts": "Connected accounts",
  "settings.settingsSidebar.general": "General",
  "settings.settingsSidebar.models": "Models",
  "settings.sign.button": "Sign in at NOTOS",
  "settings.sign.explanation":
    "You sign in at NOTOS. Once you are signed in there, this works by itself.",
  "settings.sign.local":
    "Locally: sign in at notos.zuid.com in the same browser and reload this page.",
};

export default settings;
