import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateIntegrationDto {

  @IsNotEmpty()
  @IsString()
  lineChannelSecret: string;

  @IsNotEmpty()
  @IsString()
  lineChannelAccessToken: string;

}
