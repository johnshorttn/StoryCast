import { useEffect, useState } from "react";
import { getCurrentPlatformRole } from "./platform-roles-api";

export function usePlatformAccess() {
  const [access, setAccess] = useState<Awaited<ReturnType<typeof getCurrentPlatformRole>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void getCurrentPlatformRole()
      .then(setAccess)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load access"));
  }, []);
  return { access, error };
}
