/**
 * @file Browser-owned local-file permission service.
 */

import browser from 'webextension-polyfill';

import { log } from '../common/log';
import { FileAccessService } from './file-access-service';

export const fileAccess = new FileAccessService(browser.extension, log);
