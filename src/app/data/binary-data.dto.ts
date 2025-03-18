export class BinaryDataDto {
  constructor(
    public name: string,
    public contentType: string,
    public base64: string,
  ) {}
}
