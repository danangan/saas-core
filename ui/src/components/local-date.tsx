"use client";

import { useSyncExternalStore } from "react";

/** No time zone given: the browser's own is used. */
const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});
const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const subscribe = () => () => {};

/**
 * A date from the API (an ISO 8601 string in UTC) shown in the viewer's time zone.
 *
 * Dates are formatted only in the browser: the server doesn't know the viewer's time
 * zone, so during server rendering and hydration this renders an empty <time> element,
 * then fills it in on the client (no hydration mismatch).
 */
export function LocalDate({ iso, withTime = false }: { iso: string; withTime?: boolean }) {
  const text = useSyncExternalStore(
    subscribe,
    () => (withTime ? dateTimeFormat : dateFormat).format(new Date(iso)),
    () => null,
  );
  return <time dateTime={iso}>{text}</time>;
}
