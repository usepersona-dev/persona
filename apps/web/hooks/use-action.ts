import useSWRMutation, { type SWRMutationConfiguration } from "swr/mutation"

import { toast } from "@/components/ui/toast"
import type { ApiError } from "@/lib/api-client"

// Every write goes through here: SWR reloads `key` after a success, a failed trigger() returns undefined, and the server's message shows as a toast. Field errors stay on the fields.
// Data | undefined spells out that failure: SWR's first overload takes any throwOnError, so its types would otherwise promise Data.
export function useAction<Data, Arg = never>(key: string, action: (arg: Arg) => Promise<Data>, options?: SWRMutationConfiguration<Data | undefined, ApiError, string, Arg>) {
  const mutation = useSWRMutation<Data | undefined, ApiError, string, Arg>(key, (_, { arg }) => action(arg), { onError: (error) => toast.add({ title: error.message, type: "error" }), ...options, throwOnError: false })
  return mutation
}
