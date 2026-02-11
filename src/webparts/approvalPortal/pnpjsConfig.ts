
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { spfi, SPFI, SPFx } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/batching";
import "@pnp/sp/profiles";
import "@pnp/sp/site-users/web";
import "@pnp/sp/sputilities";

let _sp: SPFI | null = null;

export const getSP = (context?: WebPartContext): SPFI => {
  if (_sp === null && context !== undefined) {
    //You must add the @pnp/logging package to include the PnPLogging behavior it is no longer a peer dependency
    // The LogLevel set's at what level a message will be written to the console
    _sp = spfi().using(SPFx(context));
  }
  return _sp!;
};
