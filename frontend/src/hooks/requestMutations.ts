import { sendFriendRequest } from "@/lib/apis/friend.api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export const useRequestMutation = () => {
  const queryClient = useQueryClient();
  const {
    mutate: sendRequestMutation,
    isPending,
    error,
  } = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] });
      toast.success("Sent a friend request");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send friend request");
    },
  });
  return { sendRequestMutation, isPending, error };
};

// export const useAcceptRequest = () => {
//   const router = useRouter();
//   const queryClient = useQueryClient();
//   const {
//     mutate: acceptReq,
//     isPending,
//     error,
//   } = useMutation({
//     mutationFn: (id: string) => acceptFriendRequest(id),
//     onSuccess: (data) => {
//       queryClient.invalidateQueries({
//         queryKey: ['friends', 'users', 'friends-request', 'outgoingFriendReqs'],
//       });
//       router.refresh();
//       router.push('/');
//       toast.success(data.message);
//     },
//     onError: (error: Error) => {
//       toast.error(error.message || 'Failed to accept friend request');
//     },
//   });
//   return { acceptReq, isPending, error };
// };
