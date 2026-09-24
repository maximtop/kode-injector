/**
 * @file
 */

import { SettingsService } from './settings-service';
import { storage } from './storage';

export const settings = new SettingsService(storage);
