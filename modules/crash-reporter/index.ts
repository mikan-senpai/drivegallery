/** JS side of the local CrashReporter module. Null on builds/platforms without it. */
import { requireOptionalNativeModule } from 'expo-modules-core';

interface CrashReporterNative {
  getLastCrash(): Promise<string | null>;
  clearLastCrash(): void;
}

export default requireOptionalNativeModule<CrashReporterNative>('CrashReporter');
