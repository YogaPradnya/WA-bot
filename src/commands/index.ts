import { registry } from './registry.js';
import { menuCommand } from './general/menu.js';
import { myIdCommand } from './general/myId.js';
import { setMenuCommand } from './admin/setMenu.js';
import { delMenuCommand } from './admin/delMenu.js';
import { listMenuCommand } from './admin/listMenu.js';
import { gcOpenCommand } from './admin/gcOpen.js';
import { gcCloseCommand } from './admin/gcClose.js';
import { pingCommand } from './admin/ping.js';
import { cekRobloxCommand } from './general/cekRoblox.js';

export function initializeCommands(): void {
  // General Commands
  registry.register(menuCommand);
  registry.register(myIdCommand);
  registry.register(cekRobloxCommand);

  // Admin Commands
  registry.register(setMenuCommand);
  registry.register(delMenuCommand);
  registry.register(listMenuCommand);
  registry.register(gcOpenCommand);
  registry.register(gcCloseCommand);
  registry.register(pingCommand);
}

export { registry };
