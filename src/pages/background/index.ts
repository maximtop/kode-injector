/**
 * @file
 */

import { backgroundPage } from '../../app/background';
import { log } from '../../app/common/log';

backgroundPage()
    .then(() => { log.debug('All modules initiated'); })
    .catch((e: Error) => log.error(e.message));
