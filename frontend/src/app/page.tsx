"use client";
import FriendCard, { getLanguageFlag } from "@/components/FriendCard";
import NoFriendsFound from "@/components/NoFriendsFound";
import PageLoader from "@/components/PageLoader";
import { useRequestMutation } from "@/hooks/requestMutations";
import { Friend, User } from "@/interfaces/allInterface";
import { capitialize } from "@/lib/utils";
import {
  getFriendRequest,
  getOutgoingFriendReqs,
  getRecommendedUsers,
  getUserFriends,
} from "@/lib/friend.api";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircleIcon,
  MapPinIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";

const HomePage = () => {
  const [outgoingRequestsIds, setOutgoingRequestsIds] = useState(new Set());
  const [incomingRequestsIds, setIncomingRequestsIds] = useState(new Set());

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const { data: recommendedUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: getRecommendedUsers,
  });
  const { data: outgoingFriendReqs } = useQuery({
    queryKey: ["outgoingFriendReqs"],
    queryFn: getOutgoingFriendReqs,
  });

  const { data: { incomingFriendRequest } = [] } = useQuery({
    queryKey: ["friends-request"],
    queryFn: getFriendRequest,
  });

  const { sendRequestMutation, isPending: isReqSendLoading } =
    useRequestMutation();

  useEffect(() => {
    const outgoingIds = new Set();
    if (outgoingFriendReqs && outgoingFriendReqs.length > 0) {
      outgoingFriendReqs.forEach((req: { receiver: { _id: unknown } }) => {
        outgoingIds.add(req.receiver._id);
      });
      setOutgoingRequestsIds(outgoingIds);
    }
  }, [outgoingFriendReqs, recommendedUsers]);

  useEffect(() => {
    console.log(friends);
    const incomingIds = new Set();
    if (incomingFriendRequest && incomingFriendRequest.length > 0) {
      incomingFriendRequest.forEach((req: { sender: { _id: unknown } }) => {
        incomingIds.add(req.sender._id);
      });
      setIncomingRequestsIds(incomingIds);
    }
  }, [incomingFriendRequest, recommendedUsers]);

  if (loadingFriends || loadingUsers) return <PageLoader />;

  return (
    // user &&
    // user.isOnBoarded && (
    <div className="p-4 sm:p-6 lg:p-8">
      <Toaster />
      <div className="container mx-auto space-y-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Your Friends
          </h2>
          <Link href="/notifications" className="btn btn-outline btn-sm">
            <UsersIcon className="mr-2 size-4" />
            Friend Requests
          </Link>
        </div>

        {loadingFriends ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : friends.length === 0 ? (
          <NoFriendsFound />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {friends.map((friend: Friend) => (
              <FriendCard key={friend._id} friend={friend} />
            ))}
          </div>
        )}

        <section>
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Meet New Learners
                </h2>
                <p className="opacity-70">
                  Discover perfect language exchange partners based on your
                  profile
                </p>
              </div>
            </div>
          </div>

          {loadingUsers ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : recommendedUsers.length === 0 ? (
            <div className="card bg-base-200 p-6 text-center">
              <h3 className="font-semibold text-lg mb-2">
                No recommendations available
              </h3>
              <p className="text-base-content opacity-70">
                Check back later for new language partners!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendedUsers.map((user: User) => {
                const hasRequestBeenSent = outgoingRequestsIds.has(user._id);
                const hasRequestBeenReceived = incomingRequestsIds.has(
                  user._id
                );
                // const isIncomingRequest =
                return (
                  <div
                    key={user._id}
                    className="card bg-base-200 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="card-body p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="avatar size-16 rounded-full">
                          <Image
                            fill
                            sizes="80px"
                            src={`http://localhost:3001/${user.image}`}
                            alt={user.fullName}
                          />
                        </div>

                        <div>
                          <h3 className="font-semibold text-lg">
                            {user.fullName}
                          </h3>
                          {user.location && (
                            <div className="flex items-center text-xs opacity-70 mt-1">
                              <MapPinIcon className="size-3 mr-1" />
                              {user.location}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Languages with flags */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="badge badge-secondary">
                          {getLanguageFlag(user.nativeLanguage)}
                          Native: {capitialize(user.nativeLanguage)}
                        </span>
                        <span className="badge badge-outline">
                          {getLanguageFlag(user.learningLanguage)}
                          Learning: {capitialize(user.learningLanguage)}
                        </span>
                      </div>

                      {user.bio && (
                        <p className="text-sm opacity-70">{user.bio}</p>
                      )}

                      {/* Action button */}

                      {hasRequestBeenSent ? (
                        <>
                          <button
                            className={`btn w-full mt-2 btn-disabled`}
                            disabled={true}
                          >
                            <CheckCircleIcon className="size-4 mr-2" />
                            Request Sent
                          </button>
                        </>
                      ) : hasRequestBeenReceived ? (
                        <>
                          <Link href="/notifications">
                            <button className={`btn w-full mt-2 btn-primary`}>
                              <CheckCircleIcon className="size-4 mr-2" />
                              Respond
                            </button>
                          </Link>
                        </>
                      ) : (
                        <>
                          <button
                            className={`btn w-full mt-2 btn-primary`}
                            onClick={() => sendRequestMutation(user._id)}
                            disabled={isReqSendLoading}
                          >
                            <UserPlusIcon className="size-4 mr-2" />
                            Send Friend Request
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default HomePage;
