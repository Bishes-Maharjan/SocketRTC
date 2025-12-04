"use client";
import PageLoader from "@/components/PageLoader";
import { handleOAuthLogin } from "@/hooks/OAuth";
import { useAuthUser } from "@/hooks/useAuthUser";
import { axiosInstance } from "@/lib/axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ShipWheelIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import singUpImage from "../../../public/signup.png";

const SignUpPage = () => {
  const router = useRouter();
  const { user, isLoading } = useAuthUser();
  const [isClient, setIsClient] = useState(false);
  const [password, setPassword] = useState("");
  const [checksUI, setChecksUI] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[!@#$%^&/*(),.?":{}|<>]/.test(password),
  };

  // Generate avatar index only on client side to avoid hydration mismatch
  const [, setAvatarIdx] = useState(1);
  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setChecksUI(false); // hide checklist
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    password: "",
    image: "", // Will be set after client mounts
  });

  const [err, setErr] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Handle client-side mounting
  useEffect(() => {
    setIsClient(true);
    const idx = Math.floor(Math.random() * 100) + 1;
    setAvatarIdx(idx);
    setSignupData((prev) => ({
      ...prev,
      image: `http://localhost:3001/uploads/avatar.jpg`,
    }));
  }, []);

  // Handle redirects only after client mount
  useEffect(() => {
    if (isClient && user?.isOnBoarded) {
      router.replace("/");
    } else if (isClient && user && !user.isOnBoarded) {
      router.replace("/onboard");
    }
  }, [user, router, isClient]);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      await axiosInstance.post("auth/signup", signupData);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      setErr(null); // clear error on success
      router.push("/onboard");
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

  const handleSignup = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    mutate();
  };

  // Show loading until client has mounted and auth state is determined
  if (!isClient || isLoading) {
    return <PageLoader />;
  }

  // Don't render signup form if user is already authenticated
  if (user) {
    return <PageLoader />;
  }

  return (
    <div
      className="h-screen flex items-center justify-center p-4 sm:p-6 md:p-8"
      data-theme="forest"
    >
      <Toaster />
      <div className="border border-primary/25 flex flex-col lg:flex-row w-full max-w-5xl mx-auto bg-base-100 rounded-xl shadow-lg overflow-hidden">
        {/* SIGNUP FORM - LEFT SIDE */}
        <div className="w-full lg:w-1/2 p-4 sm:p-8 flex flex-col">
          {/* LOGO */}
          <div className="mb-4 flex items-center justify-start gap-2">
            <ShipWheelIcon className="size-9 text-primary" />
            <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
              Streamify
            </span>
          </div>

          {/* ERROR MESSAGE IF ANY */}
          {err && (
            <div className="alert alert-error mb-4">
              <span>{err}</span>
            </div>
          )}

          <div className="w-full">
            <form onSubmit={handleSignup}>
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Create an Account</h2>
                  <p className="text-sm opacity-70">
                    Join Streamify and start your language learning adventure!
                  </p>
                </div>

                <div className="space-y-3">
                  {/* FULLNAME */}
                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">Full Name</span>
                    </label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      className="input input-bordered w-full"
                      value={signupData.fullName}
                      onChange={(e) =>
                        setSignupData({
                          ...signupData,
                          fullName: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  {/* EMAIL */}
                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">Email</span>
                    </label>
                    <input
                      type="email"
                      placeholder="john@gmail.com"
                      className="input input-bordered w-full"
                      value={signupData.email}
                      onChange={(e) =>
                        setSignupData({
                          ...signupData,
                          email: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  {/* PASSWORD */}
                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">Password</span>
                    </label>
                    <input
                      ref={inputRef}
                      type="password"
                      placeholder="********"
                      className="input input-bordered w-full"
                      value={signupData.password}
                      onChange={(e) => {
                        setSignupData({
                          ...signupData,
                          password: e.target.value,
                        });
                        setPassword(e.target.value);
                      }}
                      onKeyDown={() => setChecksUI(true)}
                      required
                    />
                    {checksUI && (
                      <ul className="mt-2 text-sm">
                        <li
                          className={
                            checks.length ? "text-green-500" : "text-red-500"
                          }
                        >
                          • At least 8 characters
                        </li>
                        <li
                          className={
                            checks.upper ? "text-green-500" : "text-red-500"
                          }
                        >
                          • At least 1 uppercase letter
                        </li>
                        <li
                          className={
                            checks.lower ? "text-green-500" : "text-red-500"
                          }
                        >
                          • At least 1 lowercase letter
                        </li>
                        <li
                          className={
                            checks.number ? "text-green-500" : "text-red-500"
                          }
                        >
                          • At least 1 number
                        </li>
                        <li
                          className={
                            checks.symbol ? "text-green-500" : "text-red-500"
                          }
                        >
                          • At least 1 special character
                        </li>
                      </ul>
                    )}
                  </div>

                  <div className="form-control">
                    <label className="label cursor-pointer justify-start gap-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        required
                      />
                      <span className="text-xs leading-tight">
                        I agree to the{" "}
                        <span className="text-primary hover:underline">
                          terms of service
                        </span>{" "}
                        and{" "}
                        <span className="text-primary hover:underline">
                          privacy policy
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                <button
                  className="btn btn-primary w-full"
                  type="submit"
                  disabled={Object.values(checks).some((v) => v === false)}
                >
                  {isPending ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      Loading...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </button>

                <div className="divider text-sm opacity-70">OR</div>

                <button
                  type="button"
                  onClick={handleOAuthLogin}
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

                <div className="text-center mt-4">
                  <p className="text-sm">
                    Already have an account?{" "}
                    <Link
                      href="/login"
                      className="text-primary hover:underline"
                    >
                      Sign in
                    </Link>
                  </p>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* SIGNUP FORM - RIGHT SIDE */}
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

export default SignUpPage;
