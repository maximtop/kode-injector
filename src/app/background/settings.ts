/**
 * @file
 */

import { storage } from './storage';
import { SettingsService } from './settings-service';

export const settings = new SettingsService(storage);
