import { Socket } from 'socket.io';
import { ValidateUser } from 'src/globals/validateUser.dto';
import { UserDocument } from 'src/user/model/user.model';

// Simple intersection type
export type ChatRoomWithUser = UserDocument & { roomId: string };

export interface AuthenticatedSocket extends Socket {
  data: {
    user: ValidateUser;
  };
}
