/**
 * WhiteDesk SDK — Official Entry Point
 * Zero-Knowledge, Sovereign Support & Provisioning Protocol
 *
 * Can be imported as an embedded module or exported as an independent package.
 */

export * from './core/types';
export * from './core/crypto';
export * from './core/database';
export * from './core/authority';
export * from './core/client';
export { diagnosticRecorder } from '../services/diagnosticRecorder';
export { default as translations, default as helpdeskLang } from '../locales';
