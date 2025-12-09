import { axiosInstance } from "@/lib/apis/axios";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

export const useAuthUser = () => {
  // const queryClient = useQueryClient(); // Unused

  const {
    data: user,
    isLoading,
    // refetch, // Unused
  } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      try {
        const res = await axiosInstance.get("/auth/me");

        return res.data;
      } catch (error) {
        console.error("Auth query failed:", error);
        // Return null for unauthenticated users instead of throwing
        return null;
      }
    },
    // Disable query during SSR
    enabled: typeof window !== "undefined",
    // Don't retry on auth failures
    retry: (failureCount, error) => {
      // Don't retry on 401/403 errors (auth failures)
      if (isAxiosError(error))
        if (
          error?.response?.status === 401 ||
          error?.response?.status === 403
        ) {
          return false;
        }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    // Handle network errors gracefully
    retryOnMount: false,
    refetchOnWindowFocus: false,
    // Add a stale time to prevent unnecessary refetches
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return { user, isLoading };
};
