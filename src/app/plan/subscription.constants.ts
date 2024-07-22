export const subscriptionConfig = {
  currency: 'EUR',
  storageCapacity: {
    pricePerGb: 0.2,
    defaultOption: 6,
    options: [
      { size: 8, exp: 3, label: '8 GB' },
      { size: 16, exp: 4, label: '16 GB' },
      { size: 32, exp: 5, label: '32 GB' },
      { size: 64, exp: 6, label: '64 GB' },
      { size: 128, exp: 7, label: '128 GB' },
      { size: 256, exp: 8, label: '256 GB' },
      { size: 512, exp: 9, label: '512 GB' },
      { size: 1024, exp: 10, label: '1 TB' },
    ],
  },
  bandwidth: {
    pricePerGb: 0.1,
    defaultOption: 6,
    options: [
      { size: 8, exp: 3, label: '8 GB' },
      { size: 16, exp: 4, label: '16 GB' },
      { size: 32, exp: 5, label: '32 GB' },
      { size: 64, exp: 6, label: '64 GB' },
      { size: 128, exp: 7, label: '128 GB' },
      { size: 256, exp: 8, label: '256 GB' },
      { size: 512, exp: 9, label: '512 GB' },
      { size: 1024, exp: 10, label: '1 TB' },
    ],
  },
};
