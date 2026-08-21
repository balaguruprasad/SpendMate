/**
 * Thin wrapper over react-hot-toast so callers keep a stable
 * `toast.success/error/warning/info/message` API. react-hot-toast has no
 * `warning`/`info` variants, so those are mapped to a default toast with an
 * icon. Brand/theme styling is applied globally on the `<Toaster/>` mounted in
 * `@/providers`.
 */
import hot from "react-hot-toast";

export const toast = {
  success: (m: string) => hot.success(m),
  error: (m: string) => hot.error(m),
  warning: (m: string) => hot(m, { icon: "⚠️" }),
  info: (m: string) => hot(m, { icon: "ℹ️" }),
  message: (m: string) => hot(m),
};
