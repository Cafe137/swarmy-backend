export const subscriptionConfig = {
  currency: 'EUR',
  storageCapacity: {
    pricePerGb: 0.2,
    defaultOption: 4,
    options: [
      { size: 4, exp: 2, label: '4 GB' },
      { size: 17, exp: 4, label: '17 GB' },
      { size: 44, exp: 5, label: '44 GB' },
      { size: 102, exp: 7, label: '102 GB' },
      { size: 225, exp: 8, label: '225 GB' },
      { size: 480, exp: 9, label: '480 GB' },
      { size: 1000, exp: 10, label: '1 TB' },
    ],
  },
  bandwidth: {
    pricePerGb: 0.01,
    defaultOption: 5,
    options: [
      { size: 4, exp: 2, label: '4 GB' },
      { size: 8, exp: 3, label: '8 GB' },
      { size: 16, exp: 4, label: '16 GB' },
      { size: 32, exp: 5, label: '32 GB' },
      { size: 64, exp: 6, label: '64 GB' },
      { size: 128, exp: 7, label: '128 GB' },
      { size: 256, exp: 8, label: '256 GB' },
      { size: 512, exp: 9, label: '512 GB' },
      { size: 1024, exp: 10, label: '1 TB' },
      { size: 2048, exp: 11, label: '2 TB' },
      { size: 4096, exp: 12, label: '4 TB' },
    ],
  },
};
