/**
 * Modul untuk menyaring log diagnostik mentah internal dari library libsignal (Signal Protocol)
 * agar tidak mencetak dump objek buffer sesi dan ratchet ke terminal.
 */
export function silenceLibsignalLogs(): void {
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalLog = console.log;
  const originalError = console.error;

  const isLibsignalNoise = (args: any[]): boolean => {
    if (!args || args.length === 0) return false;
    const first = args[0];
    if (typeof first === 'string') {
      return (
        first.startsWith('Closing session:') ||
        first.startsWith('Opening session:') ||
        first.includes('Closing open session in favor of incoming prekey bundle') ||
        first.includes('Session already closed') ||
        first.includes('Session already open') ||
        first.startsWith('Removing old closed session:') ||
        first.startsWith('Migrating session to:') ||
        first.includes('Bad MAC') ||
        first.includes('Failed to decrypt message with any known session')
      );
    }
    return false;
  };

  console.info = (...args: any[]) => {
    if (isLibsignalNoise(args)) return;
    originalInfo.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    if (isLibsignalNoise(args)) return;
    originalWarn.apply(console, args);
  };

  console.log = (...args: any[]) => {
    if (isLibsignalNoise(args)) return;
    originalLog.apply(console, args);
  };

  console.error = (...args: any[]) => {
    if (isLibsignalNoise(args)) return;
    originalError.apply(console, args);
  };
}
