import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from 'src/auth/guard/jwtGuard';
import { Irequest } from 'src/globals/Req.dto';
import { UserService } from './user.service';

@ApiTags('user')
@UseGuards(JwtGuard)
@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  // -----------Render for us logic---------------

  @Get('getAllUsers')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get All Users' })
  async getAllUsers() {
    const users = await this.userService.getAllUsers();
    return users;
  }

  @Get('recommendation')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get Recommended Users' })
  async getRecommendedUsers(@Req() req: Irequest) {
    const {
      user: { id },
    } = req;
    const result = await this.userService.getRecommendedUsers(id);
    return result;
  }

  @HttpCode(200)
  @Get('friends')
  @ApiOperation({ summary: 'Get My Friends' })
  async getMyFriends(@Req() req: Irequest) {
    const {
      user: { id },
    } = req;
    const result = await this.userService.getFriendWithChatRoomId(id);
    return result;
  }

  //---------------Friend Request Logic------------------------
  //Get all FR to render related to user
  @Get('friend-request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get Notification Friend Requests' })
  getFriendRequest(@Req() { user: { id } }: Irequest) {
    return this.userService.getFriendRequest(id);
  }

  // send fr
  @Post('friend-request/:id')
  @HttpCode(201)
  @ApiOperation({ summary: 'Send Friend Request' })
  sendFriendRequest(
    @Param('id') receiver: string,
    @Req() { user: { id: sender } }: Irequest,
  ) {
    if (receiver == sender)
      throw new BadRequestException('You cant send fr to yourself');
    return this.userService.sendFriendRequest(receiver, sender);
  }

  //accept fr
  @Patch('accept/friend-request/:id')
  @HttpCode(201)
  @ApiOperation({ summary: 'Accept Friend Request' })
  acceptFriendRequest(
    @Param('id') id: string,

    @Req() { user: { id: receiver } }: Irequest,
  ) {
    return this.userService.acceptFriendRequest(receiver, id);
  }

  //reject fr
  @Delete('reject/friend-request/:id')
  @ApiOperation({ summary: 'Reject Friend Request' })
  rejectFriendRequest(
    @Param('id') id: string,

    @Req() { user: { id: receiver } }: Irequest,
  ) {
    return this.userService.rejectFriendRequest(receiver, id);
  }

  //our outgoing fr to see if we have alr send the req
  @Get('outgoing-friend-request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get Out Going Friend Request' })
  getOutGoingFriendRequest(@Req() { user: { id } }: Irequest) {
    return this.userService.getOutGoingFriendRequest(id);
  }

  //------------------------Notification Logic------------------------
  //get notification total count to show in front the unread notification
  @Get('notification/count')
  @HttpCode(200)
  @ApiOperation({ summary: 'Count All User Notification' })
  countNotification(@Req() { user: { id } }: Irequest) {
    return this.userService.getTotalNotification(id);
  }
  //read all the notification
  @Patch('notification/read')
  @ApiOperation({ summary: 'Mark all notification as read' })
  markAsReadNotification(@Req() { user: { id } }: Irequest) {
    return this.userService.readAllNotifications(id);
  }

  @Delete('friend-request/deleteAll')
  @ApiOperation({ summary: 'Delete all FR' })
  delAllFr() {
    return this.userService.delAllFr();
  }

  @Get(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get user' })
  async getUser(@Param('id') id: string) {
    const user = await this.userService.getUserById(id);
    return user;
  }
}
