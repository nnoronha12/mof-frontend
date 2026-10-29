/** A cross-origin frame must not be able to inject chat replies or lock state. */
export function isTrustedHostMessage(
  event: Pick<MessageEvent, 'origin' | 'source'>,
  pageOrigin: string,
  hasNativeBridge: boolean,
): boolean {
  if (pageOrigin !== 'null' && event.origin === pageOrigin) return true;
  // React Native injects synthetic messages without a browser sender. An
  // opaque-origin iframe still has a non-null source and is not this bridge.
  return hasNativeBridge && event.source === null &&
    (event.origin === '' || event.origin === 'null');
}
