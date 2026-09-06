// NOTOS i18n: alle woordenboeken van deze taal samengevoegd. Elke schermgroep heeft een eigen
// bestand, zodat vertalers elkaar niet in de weg zitten. Sleutels zijn uniek per groep.
import adminA from "./admin-a";
import adminB from "./admin-b";
import channels from "./channels";
import common from "./common";
import components from "./components";
import connectors from "./connectors";
import gallery from "./gallery";
import lib from "./lib";
import server from "./server";
import settings from "./settings";
import workspace from "./workspace";

const dictionary: Record<string, string> = {
  ...common,
  ...adminA,
  ...adminB,
  ...settings,
  ...workspace,
  ...channels,
  ...components,
  ...connectors,
  ...gallery,
  ...lib,
  ...server,
};

export default dictionary;
