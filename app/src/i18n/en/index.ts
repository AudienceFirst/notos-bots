// NOTOS i18n: alle woordenboeken van deze taal samengevoegd. Elke schermgroep heeft een eigen
// bestand, zodat vertalers elkaar niet in de weg zitten. Sleutels zijn uniek per groep.
import adminA from "./admin-a";
import adminB from "./admin-b";
import channels from "./channels";
import common from "./common";
import components from "./components";
import lib from "./lib";
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
  ...lib,
};

export default dictionary;
