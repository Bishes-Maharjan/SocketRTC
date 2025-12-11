"use client";
import { SearchableDropdown } from "@/components/SearchableDropdown";
import { COUNTRIES, LANGUAGES } from "@/constants/locations";
import { axiosInstance } from "@/lib/apis/axios";
import { getImage } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  AlertCircleIcon,
  CameraIcon,
  LoaderIcon,
  ShipWheelIcon
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

type User = {
  fullName: string;
  bio: string;
  nativeLanguage: string;
  learningLanguage: string;
  image: string;
  location: string;
  _id: string;
  provider: string;
  isOnBoarded: boolean;
};

// Searchable Dropdown Component


const OnboardingForm = ({
  userFromServer: authUser,
}: {
  userFromServer: User;
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formState, setFormState] = useState(() => ({
    fullName: authUser?.fullName || "",
    bio: authUser?.bio || "",
    nativeLanguage: authUser?.nativeLanguage || "",
    learningLanguage: authUser?.learningLanguage || "",
    location: authUser?.location || "",
    image: authUser?.image || '/uploads/avatar.jpg'
  }));

  const [errors, setErrors] = useState({
    fullName: "",
    location: "",
    nativeLanguage: "",
    learningLanguage: "",
  });

  const [imageCount, setImageCount] = useState(0);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isLoading] = useState(false);

  useEffect(() => {
    const newErrors = {
      fullName:
        formState.fullName.length < 7
          ? "Name must be at least 7 characters"
          : "",
      location: formState.location.length < 2 ? "Please select a location" : "",
      nativeLanguage: !formState.nativeLanguage
        ? "Please select your native language"
        : "",
      learningLanguage: !formState.learningLanguage
        ? "Please select a learning language"
        : "",
    };

    setErrors(newErrors);
    setIsFormValid(
      formState.fullName.length >= 5 &&
        formState.nativeLanguage !== "" &&
        formState.learningLanguage !== "" &&
        formState.location.length >= 2 &&
        Object.values(newErrors).every((error) => error === "")
    );
  }, [formState]);

  const { mutate: onboardingMutation, isPending } = useMutation({
    mutationFn: async (userData: typeof formState) => {
      const response = await axiosInstance.post("auth/onboard", userData);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Profile onboarded successfully");
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      router.replace("/");
    },
    onError: (error) => {
      if (error && isAxiosError(error)) {
        toast.error(error.response?.data.message || "An error occurred");
      }
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isFormValid) {
      onboardingMutation(formState);
    }
  };

  return (
    <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
      <div className="card bg-base-200 w-full max-w-2xl shadow-xl">
        <div className="card-body p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2">
            {authUser.isOnBoarded ? "Edit" : "Complete"} Your Profile
          </h1>
          <p className="text-center text-base-content/60 mb-6">
            Tell us about yourself to get started
          </p>
          <Toaster position="top-center" />

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* PROFILE PIC */}
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="relative size-28 rounded-full bg-base-300 overflow-hidden ring-2 ring-primary/20">
                {formState.image ? (
                  <Image
                    fill
                    sizes="112px"
                    className="object-cover"
                    src={getImage(formState.image)}
                    alt="Profile Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <CameraIcon className="size-10 text-base-content/30" />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <label className="btn btn-primary cursor-pointer">
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      const fd = new FormData();
                      fd.append("image", file);

                      const res = await axiosInstance.post("/upload", fd, {
                        headers: { "Content-Type": "multipart/form-data" },
                      });
                      setImageCount((prev) => prev + 1);
                      setFormState((prev) => ({
                        ...prev,
                        image: `${res.data.url}`,
                      }));
                    }}
                  />
                </label>
                {imageCount >= 1 && authUser?.image && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      setFormState({ ...formState, image: authUser?.image });
                    }}
                    className="btn btn-sm btn-ghost"
                  >
                    <ShipWheelIcon className="size-4" />
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="divider my-4"></div>

            {/* FULL NAME */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Full Name</span>
                {errors.fullName && (
                  <span className="label-text-alt text-error flex items-center gap-1">
                    <AlertCircleIcon className="size-3" />
                    {errors.fullName}
                  </span>
                )}
              </label>
              <input
                type="text"
                name="fullName"
                value={formState.fullName}
                onChange={(e) =>
                  setFormState({ ...formState, fullName: e.target.value })
                }
                className={`input input-bordered w-full ${
                  errors.fullName ? "input-error" : ""
                }`}
                placeholder="Enter your full name"
                minLength={3}
                required
              />
            </div>

            {/* BIO */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Bio</span>
                <span className="label-text-alt text-base-content/60">
                  Optional
                </span>
              </label>
              <textarea
                name="bio"
                value={formState.bio}
                onChange={(e) =>
                  setFormState({ ...formState, bio: e.target.value })
                }
                className="textarea textarea-bordered h-20 resize-none"
                placeholder="Tell us a bit about yourself..."
              />
            </div>

            {/* NATIVE LANGUAGE - Searchable */}
            <SearchableDropdown
              label="Native Language"
              options={LANGUAGES}
              value={formState.nativeLanguage}
              onChange={(value) =>
                setFormState({ ...formState, nativeLanguage: value })
              }
              placeholder="Select your native language"
              error={errors.nativeLanguage}
            />

            {/* LEARNING LANGUAGE - Searchable */}
            <SearchableDropdown
              label="Learning Language"
              options={LANGUAGES}
              value={formState.learningLanguage}
              onChange={(value) =>
                setFormState({ ...formState, learningLanguage: value })
              }
              placeholder="Select language you're learning"
              error={errors.learningLanguage}
            />

            {/* LOCATION - Searchable */}
            <SearchableDropdown
              label="Location"
              options={COUNTRIES}
              value={formState.location}
              onChange={(value) =>
                setFormState({ ...formState, location: value })
              }
              placeholder="Select your country"
              error={errors.location}
            />

            {/* SUBMIT BUTTON */}
            <div className="pt-2">
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={!isFormValid || isPending}
              >
                {isPending ? (
                  <>
                    <LoaderIcon className="animate-spin size-4" />
                    Submitting...
                  </>
                ) : (
                  <>
                    {authUser.isOnBoarded ? "Update Profile" : "Complete Setup"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OnboardingForm;
