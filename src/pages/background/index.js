import { backgroundPage } from '../../js/background';
import { log } from '../../js/common/log';

backgroundPage().then(() => { log.debug('All modules initiated'); }).catch((e) => log.error(e.message));
