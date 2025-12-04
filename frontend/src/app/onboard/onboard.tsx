"use client";
import { COUNTRIES, LANGUAGES } from "@/constants/locations";
import { axiosInstance } from "@/lib/axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  AlertCircleIcon,
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  LoaderIcon,
  SearchIcon,
  ShipWheelIcon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
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
const SearchableDropdown = ({
  label,
  options,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="form-control" ref={dropdownRef}>
      <label className="label">
        <span className="label-text font-medium">{label}</span>
        {error && (
          <span className="label-text-alt text-error flex items-center gap-1">
            <AlertCircleIcon className="size-3" />
            {error}
          </span>
        )}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`input input-bordered w-full flex items-center justify-between ${
            error ? "input-error" : ""
          } ${!value ? "text-base-content/40" : ""}`}
        >
          <span className="truncate text-left flex-1">
            {value || placeholder}
          </span>
          <ChevronDownIcon
            className={`size-4 transition-transform flex-shrink-0 ml-2 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-64 flex flex-col">
            <div className="p-2 border-b border-base-300 sticky top-0 bg-base-100">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/40" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="input input-sm input-bordered w-full pl-9"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      onChange(option);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full px-4 py-2.5 text-left hover:bg-base-200 flex items-center justify-between transition-colors ${
                      value === option ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <span>{option}</span>
                    {value === option && <CheckIcon className="size-4" />}
                  </button>
                ))
              ) : (
                <div className="px-4 py-6 text-center text-base-content/40">
                  No results found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

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
    image:
      authUser?.provider == "google"
        ? authUser?.image
        : `${process.env.NEXT_PUBLIC_API_URL}uploads/avatar.jpg`,
  }));

  const [errors, setErrors] = useState({
    fullName: "",
    location: "",
    nativeLanguage: "",
    learningLanguage: "",
  });

  const [imageCount, setImageCount] = useState(0);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
                    src={formState.image}
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
                        image: res.data.url,
                      }));
                      console.log(res.data.url);
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
