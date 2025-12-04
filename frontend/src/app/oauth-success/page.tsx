"use client";
import PageLoader from "@/components/PageLoader";
import { axiosInstance } from "@/lib/apis/axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

function Page() {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { mutate: setCookieMutate } = useMutation({
    mutationFn: async (token: string) => {
      const res = await axiosInstance.post("auth/set-cookie", { token });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      toast.success(data.message);
      setTimeout(() => {
        router.push("/");
      }, 1500);
    },
    onError: () => {
      toast.error("Something went wrong. Try again.");
      setIsLoading(false);
    },
  });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) {
      setCookieMutate(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  if (isLoading) return <PageLoader />;
  return <div></div>;
}

export default Page;
