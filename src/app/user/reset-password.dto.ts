export class ResetPasswordDto {
  constructor(
    public token: string,
    public password: string,
  ) {}
}
