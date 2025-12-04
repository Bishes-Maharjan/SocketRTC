"use client";
import { ShipWheelIcon } from "lucide-react";
import singUpImage from "../../../public/signup.png";

import { useAuth } from "@/auth/AuthProvider";
import { handleOAuthLogin } from "@/hooks/OAuth";
import { axiosInstance } from "@/lib/apis/axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

const LoginPage = () => {
  const { user, isLoading } = useAuth();
  const [isClient, setIsClient] = useState(false);

  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });
  const router = useRouter();
  const queryClient = useQueryClient();

  // Handle client-side mounting
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && user?.isOnBoarded) {
      router.replace("/");
    } else if (isClient && user && !user.isOnBoarded) {
      router.replace("/onboard");
    }
  }, [user, router, isClient]);

  const {
    isPending,
    error,
    mutate: loginMutation,
  } = useMutation({
    mutationFn: async (userData: typeof loginData) => {
      const res = await axiosInstance.post("auth/signin", userData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      setTimeout(() => {
        router.replace("/");
      }, 500);
    },
    onError: (error) => {
      const msg = isAxiosError(error)
        ? Array.isArray(error.response?.data?.message)
          ? error.response?.data?.message.join("\n") // join with newlines
          : error.response?.data?.message
        : error?.message || "Something went wrong!";

      toast.error(msg);
    },
  });

  const handleLogin = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    loginMutation(loginData);
  };

  // Always show loading until client has mounted and auth state is determined
  if (!isClient || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  // Don't render login form if user is already authenticated
  if (user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  // Only render the login form when we're sure there's no user
  return (
    <div
      className="h-screen flex items-center justify-center p-4 sm:p-6 md:p-8"
      data-theme="forest"
    >
      <Toaster />
      <div className="border border-primary/25 flex flex-col lg:flex-row w-full max-w-5xl mx-auto bg-base-100 rounded-xl shadow-lg overflow-hidden">
        {/* LOGIN FORM SECTION */}
        <div className="w-full lg:w-1/2 p-4 sm:p-8 flex flex-col">
          {/* LOGO */}
          <div className="mb-4 flex items-center justify-start gap-2">
            <ShipWheelIcon className="size-9 text-primary" />
            <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary  tracking-wider">
              Streamify
            </span>
          </div>

          <div className="w-full">
            <form onSubmit={handleLogin}>
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Welcome Back</h2>
                  <p className="text-sm opacity-70">
                    Sign in to your account to continue your language journey
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="form-control w-full space-y-2">
                    <label className="label">
                      <span className="label-text">Email</span>
                    </label>
                    <input
                      type="email"
                      placeholder="hello@example.com"
                      className="input input-bordered w-full"
                      value={loginData.email}
                      onChange={(e) =>
                        setLoginData({ ...loginData, email: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-control w-full space-y-2">
                    <label className="label">
                      <span className="label-text">Password</span>
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="input input-bordered w-full"
                      value={loginData.password}
                      onChange={(e) => {
                        setLoginData({
                          ...loginData,
                          password: e.target.value,
                        });
                      }}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-full"
                    disabled={isPending}
                  >
                    {isPending ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </button>

                  <div className="text-center mt-4">
                    <p className="text-sm">
                      Don&apos;t have an account?{" "}
                      <Link
                        href="/signup"
                        className="text-primary hover:underline"
                      >
                        Create one
                      </Link>
                    </p>
                  </div>

                  <div className="divider text-sm opacity-70">OR</div>

                  <button
                    type="button"
                    onClick={() => handleOAuthLogin()}
                    className="btn w-full border border-gray-300 bg-white hover:bg-gray-100 text-gray-800 flex items-center justify-center gap-2"
                  >
                    <Image
                      src="https://www.svgrepo.com/show/475656/google-color.svg"
                      alt="Google icon"
                      width={20}
                      height={20}
                    />
                    Continue with Google
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* IMAGE SECTION */}
        <div className="hidden lg:flex w-full lg:w-1/2 bg-primary/10 items-center justify-center">
          <div className="max-w-md p-8">
            {/* Illustration */}
            <div className="relative aspect-square max-w-sm mx-auto">
              <Image
                src={singUpImage}
                alt="Language connection illustration"
                className="w-full h-full"
              />
            </div>

            <div className="text-center space-y-3 mt-6">
              <h2 className="text-xl font-semibold">
                Connect with language partners worldwide
              </h2>
              <p className="opacity-70">
                Practice conversations, make friends, and improve your language
                skills together
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
