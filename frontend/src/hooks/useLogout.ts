import { axiosInstance } from "@/lib/apis/axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export const useLogout = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { mutate: logout, isPending } = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.post("auth/logout");

      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      queryClient.setQueryData(["auth-user"], null);
      setTimeout(() => {
        router.push("/");
      }, 3000);
    },
  });

  return { logout, isPending };
};
