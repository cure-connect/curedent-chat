import { IsNotEmpty, IsString } from 'class-validator';

export class LineIntegrationDto {
  @IsNotEmpty()
  @IsString()
  lineChannelId: string;

  @IsNotEmpty()
  @IsString()
  lineChannelSecret: string;

  @IsNotEmpty()
  @IsString()
  lineChannelAccessToken: string;
}
