import { IsNotEmpty, IsString } from 'class-validator';

export class SaveIntegrationDto {
  @IsNotEmpty()
  @IsString()
  lineChannelId: string;

  @IsNotEmpty()
  @IsString()
  lineChannelSecret: string;

  @IsNotEmpty()
  @IsString()
  lineChannelAccessToken: string;

  @IsNotEmpty()
  @IsString()
  sessionId: string;

  @IsNotEmpty()
  @IsString()
  confirmed: boolean;
}
