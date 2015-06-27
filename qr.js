/**
 * Namespace for QR related activies.
 * QR code versions 1 through 40 can be generated for string data, encoded as
 * ASCII bytes.
 *
 * @author Andy Hou
 *
 * Special thanks to the excellent tutorial found here:
 * http://www.thonky.com/qr-code-tutorial/
 */

var qr = {};


// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------


qr.C = {};


qr.C.MIN_VERSION = 1;
qr.C.MAX_VERSION = 40;


qr.C.ERROR_CORRECTION_LEVELS = ['L', 'M', 'Q', 'H'];
qr.C.ECL_TO_CODE_TABLE = {  // Bits used in generating the format string.
  L : 1,
  M : 0,
  Q : 3,
  H : 2,
};


qr.C.PAD_BYTES = [236, 17];  // Repeating bytes used to pad the encoded data.


qr.C.UNDEFINED_MODULE = -1;  // Represents an unset matrix module in the QR Code.
qr.C.RESERVED_FORMAT  = -2;  // A matrix module reserved for format string.
qr.C.RESERVED_VERSION = -3;  // A matrix module reserved for version string.


qr.C.QUIET_ZONE_SIZE = 4;    // Size in modules of the required blank area around the QR code.


qr.C.FINDER_PATTERN_SIZE = 7;
qr.C.FINDER_PATTERN = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1]
];


qr.C.ALIGNMENT_PATTERN_SIZE = 5;
qr.C.ALIGNMENT_PATTERN = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1]
];


qr.C.ALIGNMENT_PATTERN_LOCATIONS = [
  [],  // unused
  [],  // version 1
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
  [6, 28, 50, 72,  94],
  [6, 26, 50, 74,  98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74,  98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170]   // version 40
];


qr.C.MASK_FUNCTIONS = [  // If true, then the module value is masked (fliped). Only data+error bits are masked.
  function(row, col) { return (row + col) % 2 == 0; },
  function(row, col) { return row % 2 == 0; },
  function(row, col) { return col % 3 == 0; },
  function(row, col) { return (row + col) % 3 == 0; },
  function(row, col) { return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 == 0; },
  function(row, col) { return (row * col) % 2 + (row * col) % 3 == 0; },
  function(row, col) { return ((row * col) % 2 + (row * col) % 3) % 2 == 0; },
  function(row, col) { return ((row + col) % 2 + (row * col) % 3) % 2 == 0; }
];


// Used to compute penalty score 3.
qr.C.PENALTY_SCORE = 40;
qr.C.PENALTY_PATTERN_SIZE = 11;
qr.C.PENALTY_PATTERNS = [
  [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0],
];


// Simplified finite field where values can only be 0 or 1.
qr.C.GALOIS_FIELD_1 = {
  multiply: function(a, b) {
    return a * b;
  }
};


// Galois Field with integer values between 1 and 255 inclusive.
// Used for Reed-Solomon error correction.
qr.C.GALOIS_FIELD_256 = {
  intToAlphaExpTable_: undefined,
  alphaExpToIntTable_: undefined,
  init_: function() {  // Generate the conversion tables between alpha^exp and int value.
    var value = 1;
    this.intToAlphaExpTable_ = {};
    this.alphaExpToIntTable_ = {};
    for (var expValue = 0; expValue <= 255; expValue++) {
      this.intToAlphaExpTable_[value] = expValue;
      this.alphaExpToIntTable_[expValue] = value;
      value *= 2;
      if (value > 255) {
        value ^= 285;
      }
    }
  },
  intToAlphaExp: function(value) {
    if (!this.intToAlphaExpTable_) this.init_();
    return this.intToAlphaExpTable_[value];
  },
  alphaExpToInt: function(expValue) {
    if (!this.alphaExpToIntTable_) this.init_();
    return this.alphaExpToIntTable_[expValue];
  },
  multiply: function(a, b) {
    // Multiplication is performed by converting to alpha^exp and adding exponents.
    var aExp = this.intToAlphaExp(a);
    var bExp = this.intToAlphaExp(b);
    return this.alphaExpToInt((aExp + bExp) % 255);
  }
};


qr.C.FORMAT_STRING_GENERATOR = [1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 1];
qr.C.FORMAT_STRING_MASK = 21522;  // The 15 bit mask for the version string.


qr.C.VERSION_STRING_GENERATOR = [1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1];


// Table used to structure the encoded data depending on the Error Correction Level and the version.
// ECC is the number of error correction codewords per block.
// G1B is the number of group 1 blocks.
// G1C is the number of group 1 data codewords.
// G2B is the number of group 2 blocks.
// G2C is the number of group 2 data codewords.
qr.C.ERROR_CORRECTION_TABLE = [
  {},                                 // unused
  { L: {ECC:  7, G1B:  1, G1C:  19},  // version 1
    M: {ECC: 10, G1B:  1, G1C:  16},
    Q: {ECC: 13, G1B:  1, G1C:  13},
    H: {ECC: 17, G1B:  1, G1C:   9}},
  { L: {ECC: 10, G1B:  1, G1C:  34},
    M: {ECC: 16, G1B:  1, G1C:  28},
    Q: {ECC: 22, G1B:  1, G1C:  22},
    H: {ECC: 28, G1B:  1, G1C:  16}},
  { L: {ECC: 15, G1B:  1, G1C:  55},
    M: {ECC: 26, G1B:  1, G1C:  44},
    Q: {ECC: 18, G1B:  2, G1C:  17},
    H: {ECC: 22, G1B:  2, G1C:  13}},
  { L: {ECC: 20, G1B:  1, G1C:  80},
    M: {ECC: 18, G1B:  2, G1C:  32},
    Q: {ECC: 26, G1B:  2, G1C:  24},
    H: {ECC: 16, G1B:  4, G1C:   9}},
  { L: {ECC: 26, G1B:  1, G1C: 108},
    M: {ECC: 24, G1B:  2, G1C:  43},
    Q: {ECC: 18, G1B:  2, G1C:  15, G2B:  2, G2C:  16},
    H: {ECC: 22, G1B:  2, G1C:  11, G2B:  2, G2C:  12}},
  { L: {ECC: 18, G1B:  2, G1C:  68},
    M: {ECC: 16, G1B:  4, G1C:  27},
    Q: {ECC: 24, G1B:  4, G1C:  19},
    H: {ECC: 28, G1B:  4, G1C:  15}},
  { L: {ECC: 20, G1B:  2, G1C:  78},
    M: {ECC: 18, G1B:  4, G1C:  31},
    Q: {ECC: 18, G1B:  2, G1C:  14, G2B:  4, G2C:  15},
    H: {ECC: 26, G1B:  4, G1C:  13, G2B:  1, G2C:  14}},
  { L: {ECC: 24, G1B:  2, G1C:  97},
    M: {ECC: 22, G1B:  2, G1C:  38, G2B:  2, G2C:  39},
    Q: {ECC: 22, G1B:  4, G1C:  18, G2B:  2, G2C:  19},
    H: {ECC: 26, G1B:  4, G1C:  14, G2B:  2, G2C:  15}},
  { L: {ECC: 30, G1B:  2, G1C: 116},
    M: {ECC: 22, G1B:  3, G1C:  36, G2B:  2, G2C:  37},
    Q: {ECC: 20, G1B:  4, G1C:  16, G2B:  4, G2C:  17},
    H: {ECC: 24, G1B:  4, G1C:  12, G2B:  4, G2C:  13}},
  { L: {ECC: 18, G1B:  2, G1C:  68, G2B:  2, G2C:  69},
    M: {ECC: 26, G1B:  4, G1C:  43, G2B:  1, G2C:  44},
    Q: {ECC: 24, G1B:  6, G1C:  19, G2B:  2, G2C:  20},
    H: {ECC: 28, G1B:  6, G1C:  15, G2B:  2, G2C:  16}},
  { L: {ECC: 20, G1B:  4, G1C:  81},
    M: {ECC: 30, G1B:  1, G1C:  50, G2B:  4, G2C:  51},
    Q: {ECC: 28, G1B:  4, G1C:  22, G2B:  4, G2C:  23},
    H: {ECC: 24, G1B:  3, G1C:  12, G2B:  8, G2C:  13}},
  { L: {ECC: 24, G1B:  2, G1C:  92, G2B:  2, G2C:  93},
    M: {ECC: 22, G1B:  6, G1C:  36, G2B:  2, G2C:  37},
    Q: {ECC: 26, G1B:  4, G1C:  20, G2B:  6, G2C:  21},
    H: {ECC: 28, G1B:  7, G1C:  14, G2B:  4, G2C:  15}},
  { L: {ECC: 26, G1B:  4, G1C: 107},
    M: {ECC: 22, G1B:  8, G1C:  37, G2B:  1, G2C:  38},
    Q: {ECC: 24, G1B:  8, G1C:  20, G2B:  4, G2C:  21},
    H: {ECC: 22, G1B: 12, G1C:  11, G2B:  4, G2C:  12}},
  { L: {ECC: 30, G1B:  3, G1C: 115, G2B:  1, G2C: 116},
    M: {ECC: 24, G1B:  4, G1C:  40, G2B:  5, G2C:  41},
    Q: {ECC: 20, G1B: 11, G1C:  16, G2B:  5, G2C:  17},
    H: {ECC: 24, G1B: 11, G1C:  12, G2B:  5, G2C:  13}},
  { L: {ECC: 22, G1B:  5, G1C:  87, G2B:  1, G2C:  88},
    M: {ECC: 24, G1B:  5, G1C:  41, G2B:  5, G2C:  42},
    Q: {ECC: 30, G1B:  5, G1C:  24, G2B:  7, G2C:  25},
    H: {ECC: 24, G1B: 11, G1C:  12, G2B:  7, G2C:  13}},
  { L: {ECC: 24, G1B:  5, G1C:  98, G2B:  1, G2C:  99},
    M: {ECC: 28, G1B:  7, G1C:  45, G2B:  3, G2C:  46},
    Q: {ECC: 24, G1B: 15, G1C:  19, G2B:  2, G2C:  20},
    H: {ECC: 30, G1B:  3, G1C:  15, G2B: 13, G2C:  16}},
  { L: {ECC: 28, G1B:  1, G1C: 107, G2B:  5, G2C: 108},
    M: {ECC: 28, G1B: 10, G1C:  46, G2B:  1, G2C:  47},
    Q: {ECC: 28, G1B:  1, G1C:  22, G2B: 15, G2C:  23},
    H: {ECC: 28, G1B:  2, G1C:  14, G2B: 17, G2C:  15}},
  { L: {ECC: 30, G1B:  5, G1C: 120, G2B:  1, G2C: 121},
    M: {ECC: 26, G1B:  9, G1C:  43, G2B:  4, G2C:  44},
    Q: {ECC: 28, G1B: 17, G1C:  22, G2B:  1, G2C:  23},
    H: {ECC: 28, G1B:  2, G1C:  14, G2B: 19, G2C:  15}},
  { L: {ECC: 28, G1B:  3, G1C: 113, G2B:  4, G2C: 114},
    M: {ECC: 26, G1B:  3, G1C:  44, G2B: 11, G2C:  45},
    Q: {ECC: 26, G1B: 17, G1C:  21, G2B:  4, G2C:  22},
    H: {ECC: 26, G1B:  9, G1C:  13, G2B: 16, G2C:  14}},
  { L: {ECC: 28, G1B:  3, G1C: 107, G2B:  5, G2C: 108},
    M: {ECC: 26, G1B:  3, G1C:  41, G2B: 13, G2C:  42},
    Q: {ECC: 30, G1B: 15, G1C:  24, G2B:  5, G2C:  25},
    H: {ECC: 28, G1B: 15, G1C:  15, G2B: 10, G2C:  16}},
  { L: {ECC: 28, G1B:  4, G1C: 116, G2B:  4, G2C: 117},
    M: {ECC: 26, G1B: 17, G1C:  42},
    Q: {ECC: 28, G1B: 17, G1C:  22, G2B:  6, G2C:  23},
    H: {ECC: 30, G1B: 19, G1C:  16, G2B:  6, G2C:  17}},
  { L: {ECC: 28, G1B:  2, G1C: 111, G2B:  7, G2C: 112},
    M: {ECC: 28, G1B: 17, G1C:  46},
    Q: {ECC: 30, G1B:  7, G1C:  24, G2B: 16, G2C:  25},
    H: {ECC: 24, G1B: 34, G1C:  13}},
  { L: {ECC: 30, G1B:  4, G1C: 121, G2B:  5, G2C: 122},
    M: {ECC: 28, G1B:  4, G1C:  47, G2B: 14, G2C:  48},
    Q: {ECC: 30, G1B: 11, G1C:  24, G2B: 14, G2C:  25},
    H: {ECC: 30, G1B: 16, G1C:  15, G2B: 14, G2C:  16}},
  { L: {ECC: 30, G1B:  6, G1C: 117, G2B:  4, G2C: 118},
    M: {ECC: 28, G1B:  6, G1C:  45, G2B: 14, G2C:  46},
    Q: {ECC: 30, G1B: 11, G1C:  24, G2B: 16, G2C:  25},
    H: {ECC: 30, G1B: 30, G1C:  16, G2B:  2, G2C:  17}},
  { L: {ECC: 26, G1B:  8, G1C: 106, G2B:  4, G2C: 107},
    M: {ECC: 28, G1B:  8, G1C:  47, G2B: 13, G2C:  48},
    Q: {ECC: 30, G1B:  7, G1C:  24, G2B: 22, G2C:  25},
    H: {ECC: 30, G1B: 22, G1C:  15, G2B: 13, G2C:  16}},
  { L: {ECC: 28, G1B: 10, G1C: 114, G2B:  2, G2C: 115},
    M: {ECC: 28, G1B: 19, G1C:  46, G2B:  4, G2C:  47},
    Q: {ECC: 28, G1B: 28, G1C:  22, G2B:  6, G2C:  23},
    H: {ECC: 30, G1B: 33, G1C:  16, G2B:  4, G2C:  17}},
  { L: {ECC: 30, G1B:  8, G1C: 122, G2B:  4, G2C: 123},
    M: {ECC: 28, G1B: 22, G1C:  45, G2B:  3, G2C:  46},
    Q: {ECC: 30, G1B:  8, G1C:  23, G2B: 26, G2C:  24},
    H: {ECC: 30, G1B: 12, G1C:  15, G2B: 28, G2C:  16}},
  { L: {ECC: 30, G1B:  3, G1C: 117, G2B: 10, G2C: 118},
    M: {ECC: 28, G1B:  3, G1C:  45, G2B: 23, G2C:  46},
    Q: {ECC: 30, G1B:  4, G1C:  24, G2B: 31, G2C:  25},
    H: {ECC: 30, G1B: 11, G1C:  15, G2B: 31, G2C:  16}},
  { L: {ECC: 30, G1B:  7, G1C: 116, G2B:  7, G2C: 117},
    M: {ECC: 28, G1B: 21, G1C:  45, G2B:  7, G2C:  46},
    Q: {ECC: 30, G1B:  1, G1C:  23, G2B: 37, G2C:  24},
    H: {ECC: 30, G1B: 19, G1C:  15, G2B: 26, G2C:  16}},
  { L: {ECC: 30, G1B:  5, G1C: 115, G2B: 10, G2C: 116},
    M: {ECC: 28, G1B: 19, G1C:  47, G2B: 10, G2C:  48},
    Q: {ECC: 30, G1B: 15, G1C:  24, G2B: 25, G2C:  25},
    H: {ECC: 30, G1B: 23, G1C:  15, G2B: 25, G2C:  16}},
  { L: {ECC: 30, G1B: 13, G1C: 115, G2B:  3, G2C: 116},
    M: {ECC: 28, G1B:  2, G1C:  46, G2B: 29, G2C:  47},
    Q: {ECC: 30, G1B: 42, G1C:  24, G2B:  1, G2C:  25},
    H: {ECC: 30, G1B: 23, G1C:  15, G2B: 28, G2C:  16}},
  { L: {ECC: 30, G1B: 17, G1C: 115},
    M: {ECC: 28, G1B: 10, G1C:  46, G2B: 23, G2C:  47},
    Q: {ECC: 30, G1B: 10, G1C:  24, G2B: 35, G2C:  25},
    H: {ECC: 30, G1B: 19, G1C:  15, G2B: 35, G2C:  16}},
  { L: {ECC: 30, G1B: 17, G1C: 115, G2B:  1, G2C: 116},
    M: {ECC: 28, G1B: 14, G1C:  46, G2B: 21, G2C:  47},
    Q: {ECC: 30, G1B: 29, G1C:  24, G2B: 19, G2C:  25},
    H: {ECC: 30, G1B: 11, G1C:  15, G2B: 46, G2C:  16}},
  { L: {ECC: 30, G1B: 13, G1C: 115, G2B:  6, G2C: 116},
    M: {ECC: 28, G1B: 14, G1C:  46, G2B: 23, G2C:  47},
    Q: {ECC: 30, G1B: 44, G1C:  24, G2B:  7, G2C:  25},
    H: {ECC: 30, G1B: 59, G1C:  16, G2B:  1, G2C:  17}},
  { L: {ECC: 30, G1B: 12, G1C: 121, G2B:  7, G2C: 122},
    M: {ECC: 28, G1B: 12, G1C:  47, G2B: 26, G2C:  48},
    Q: {ECC: 30, G1B: 39, G1C:  24, G2B: 14, G2C:  25},
    H: {ECC: 30, G1B: 22, G1C:  15, G2B: 41, G2C:  16}},
  { L: {ECC: 30, G1B:  6, G1C: 121, G2B: 14, G2C: 122},
    M: {ECC: 28, G1B:  6, G1C:  47, G2B: 34, G2C:  48},
    Q: {ECC: 30, G1B: 46, G1C:  24, G2B: 10, G2C:  25},
    H: {ECC: 30, G1B:  2, G1C:  15, G2B: 64, G2C:  16}},
  { L: {ECC: 30, G1B: 17, G1C: 122, G2B:  4, G2C: 123},
    M: {ECC: 28, G1B: 29, G1C:  46, G2B: 14, G2C:  47},
    Q: {ECC: 30, G1B: 49, G1C:  24, G2B: 10, G2C:  25},
    H: {ECC: 30, G1B: 24, G1C:  15, G2B: 46, G2C:  16}},
  { L: {ECC: 30, G1B:  4, G1C: 122, G2B: 18, G2C: 123},
    M: {ECC: 28, G1B: 13, G1C:  46, G2B: 32, G2C:  47},
    Q: {ECC: 30, G1B: 48, G1C:  24, G2B: 14, G2C:  25},
    H: {ECC: 30, G1B: 42, G1C:  15, G2B: 32, G2C:  16}},
  { L: {ECC: 30, G1B: 20, G1C: 117, G2B:  4, G2C: 118},
    M: {ECC: 28, G1B: 40, G1C:  47, G2B:  7, G2C:  48},
    Q: {ECC: 30, G1B: 43, G1C:  24, G2B: 22, G2C:  25},
    H: {ECC: 30, G1B: 10, G1C:  15, G2B: 67, G2C:  16}},
  { L: {ECC: 30, G1B: 19, G1C: 118, G2B:  6, G2C: 119},    // Version 40
    M: {ECC: 28, G1B: 18, G1C:  47, G2B: 31, G2C:  48},
    Q: {ECC: 30, G1B: 34, G1C:  24, G2B: 34, G2C:  25},
    H: {ECC: 30, G1B: 20, G1C:  15, G2B: 61, G2C:  16}}
];


// -----------------------------------------------------------------------------
// Encoder
// -----------------------------------------------------------------------------


/**
 * Represents a QR code that is generated from a given string input.
 * @class
 * @param {string} stringData The data to be encoded in the QR code.
 * @param {number} optVersion The optional QR code version (size).
 * @param {string} optEcl     The optional error correction level to use.
 */
qr.Encoder = function(stringData, optVersion, optEcl) {
  this.version = undefined;
  this.size = undefined;
  this.ecl = optEcl || 'H';
  this.encodedData = undefined;
  this.structuredData = undefined;
  this.matrix = undefined;
  this.dataMask = undefined;
  this.masks = undefined;
  this.penaltyScores = undefined;
  this.bestMaskIndex = undefined;
  this.maskedMatrix = undefined;

  this.encodeData_(stringData, optVersion);
  this.generateErrorBitsAndStructureData_();

  this.initMatrixStructures_();
  this.placeFunctionPatterns_();
  this.placeReservedAreas_();
  this.fillData_();
  this.generateMasks_();
  this.computePenaltyScores_();
  this.generateMaskedMatrix_();
};


qr.Encoder.prototype.encodeData_ = function(stringData, optVersion) {
  encodedBits = [0, 1, 0, 0];  // Use byte mode encoding.

  // Find the smallest version that is large enough to contain the data.
  var requiredLength = stringData.length + 2;  // Byte mode needs 2 extra data codewords of overhead.
  for (var version = qr.C.MIN_VERSION; version <= qr.C.MAX_VERSION; version++) {
    if (this.getTotalDataCodewords_(version, this.ecl) >= requiredLength) {
      this.version = version;
      break;
    }
  }
  if (this.version == undefined) {
    throw new Error('No QR code large enough for given input data.');
  }
  // Use the optional version parameter if it is larger.
  if (optVersion && optVersion > this.version && optVersion <= qr.C.MAX_VERSION) {
    this.version = optVersion;
  }
  this.size = this.computeSize_(this.version);

  // The number of bits in the character count depends on the version and encoding mode.
  var characterCountBits = this.intToArray_(stringData.length, this.version < 10 ? 8 : 16);
  encodedBits = encodedBits.concat(characterCountBits);

  // Encode the string data as ASCII bytes.
  for (var i = 0; i < stringData.length; i++) {
    encodedBits = encodedBits.concat(this.intToArray_(stringData.charCodeAt(i), 8));
  }

  // Add the 4 bit terminator.
  var totalBytes = this.getTotalDataCodewords_(this.version, this.ecl);
  var totalBits = totalBytes * 8;
  for (var i = 0; i < 4 && encodedBits.length < totalBits; i++) {
    encodedBits.push(0);
  }
  // Add the pad bits if necessary.
  while (encodedBits.length % 8 != 0) {
    encodedBits.push(0);
  }
  // Convert bits to bytes.
  var encodedBytes = [];
  for (var i = 0; i < encodedBits.length / 8; i++) {
    encodedBytes.push(this.arrayToInt_(encodedBits.slice(i * 8, (i + 1) * 8)));
  }
  // Add the pad bytes if necessary.
  var padBytesIndex = 0;
  while (encodedBytes.length < totalBytes) {
    encodedBytes.push(qr.C.PAD_BYTES[padBytesIndex]);
    padBytesIndex = (padBytesIndex + 1) % qr.C.PAD_BYTES.length;
  }
  this.encodedData = encodedBytes;
};


qr.Encoder.prototype.computeSize_ = function(version) {
  return version * 4 + 17;
};


qr.Encoder.prototype.getTotalDataCodewords_ = function(version, ecl) {
  var ECT = qr.C.ERROR_CORRECTION_TABLE[version][ecl];
  return ECT.G1B * ECT.G1C + (ECT.G2B ? ECT.G2B * ECT.G2C : 0);
};


qr.Encoder.prototype.generateErrorBitsAndStructureData_ = function() {
  // Generate the data and error correction blocks.
  var ECT = qr.C.ERROR_CORRECTION_TABLE[this.version][this.ecl];
  var generatorPolynomial = this.computeGeneratorPolynomial_(ECT.ECC);
  var dataBlocks = [];
  var errorBlocks = [];
  var dataIndex = 0;
  var largestBlockSize = 0;
  while (dataIndex < this.encodedData.length) {
    var blockSize = dataBlocks.length < ECT.G1B ? ECT.G1C : ECT.G2C;
    var dataBlock = this.encodedData.slice(dataIndex, dataIndex + blockSize);
    var dataBlockPadded = this.padToLengthCopy_(dataBlock, dataBlock.length + ECT.ECC);
    var errorBlock = this.polynomialLongDivision_(dataBlockPadded, generatorPolynomial, qr.C.GALOIS_FIELD_256);
    dataBlocks.push(dataBlock);
    errorBlocks.push(errorBlock);
    if (blockSize > largestBlockSize) largestBlockSize = blockSize;
    dataIndex += blockSize;
  }
  // Interleave the data blocks.
  var interleavedDataBlocks = [];
  for (var i = 0; i < largestBlockSize; i++) {
    for (var blockIndex = 0; blockIndex < dataBlocks.length; blockIndex++) {
      var value = dataBlocks[blockIndex][i];
      if (value != undefined) {
        interleavedDataBlocks.push(value);
      }
    }
  }
  // Interleave the error blocks.
  var interleavedErrorBlocks = [];
  for (var i = 0; i < ECT.ECC; i++) {
    for (var blockIndex = 0; blockIndex < errorBlocks.length; blockIndex++) {
      var value = errorBlocks[blockIndex][i];
      interleavedErrorBlocks.push(value);
    }
  }
  this.structuredData = interleavedDataBlocks.concat(interleavedErrorBlocks);
};


qr.Encoder.prototype.computeGeneratorPolynomial_ = function(length) {
  var product = [1, 1];
  for (var multiplierExp = 1; multiplierExp < length; multiplierExp++) {
    var multiplier = qr.C.GALOIS_FIELD_256.alphaExpToInt(multiplierExp);
    product.push(0);
    for (var i = product.length - 1; i > 0; i--) {
      var term2 = product[i - 1];
      term2 = qr.C.GALOIS_FIELD_256.multiply(term2, multiplier);
      product[i] ^= term2;
    }
  }
  return product;
};


qr.Encoder.prototype.polynomialLongDivision_ = function(dividend, divisor, galoisField) {
  var remainder = dividend.slice();
  // Remove leading 0s.
  while (remainder.length > 0 && remainder[0] == 0) {
    remainder.shift();
  }
  // Perform division until the remainder cannot be divided further.
  while (remainder.length >= divisor.length) {
    var multiplier = remainder[0];
    for (var i = 0; i < remainder.length; i++) {
      var s = galoisField.multiply(divisor[i], multiplier);
      remainder[i] ^= s;
    }
    // Remove leading 0s.
    while (remainder.length > 0 && remainder[0] == 0) {
      remainder.shift();
    }
  }
  return remainder;
};


// Pads the given array to be the given length by padding it on the right with 0s.
qr.Encoder.prototype.padToLengthCopy_ = function(arr, length) {
  var arrCopy = arr.slice();
  while (arrCopy.length < length) {
    arrCopy.push(0);
  }
  return arrCopy;
};


// Converts an array of 0s and 1s to its integer value.
qr.Encoder.prototype.arrayToInt_ = function(arr) {
  var value = 0;
  while (arr.length > 0) {
    value *= 2;
    value += arr.shift();
  }
  return value;
};


// Converts an integer value into an array with the digits of its binary representation,
// optionally padded on the left with 0s to be the given min length.
qr.Encoder.prototype.intToArray_ = function(value, optMinLength) {
  var minLength = optMinLength || 0;
  var arr = [];
  while (value > 0 || arr.length < minLength) {
    arr.unshift(value % 2);
    value = Math.floor(value / 2);
  }
  return arr;
};


// A string of 15 bits, encoding the ECL and the mask index used.
qr.Encoder.prototype.computeFormatString_ = function(ecl, maskIndex) {
  var eclCode = qr.C.ECL_TO_CODE_TABLE[ecl];
  var formatInt = ((eclCode << 3) + maskIndex) << 10;
  var errorBits = this.polynomialLongDivision_(
      this.intToArray_(formatInt), qr.C.FORMAT_STRING_GENERATOR, qr.C.GALOIS_FIELD_1);
  return this.intToArray_((formatInt + this.arrayToInt_(errorBits)) ^ qr.C.FORMAT_STRING_MASK, 15);
};


// A string of 18 bits, encoding the version.
qr.Encoder.prototype.computeVersionString_ = function(version) {
  if (version < 7) return [];
  var versionInt = version << 12;
  var errorBits = this.polynomialLongDivision_(
      this.intToArray_(versionInt), qr.C.VERSION_STRING_GENERATOR, qr.C.GALOIS_FIELD_1);
  return this.intToArray_(versionInt + this.arrayToInt_(errorBits), 18);
};


qr.Encoder.prototype.initMatrixStructures_ = function() {
  this.matrix = this.createMatrix_();
  this.dataMask = this.createMatrix_();
};


qr.Encoder.prototype.createMatrix_ = function() {
  var matrix = [];
  for (var y = 0; y < this.size; y++) {
    var row = [];
    for (var x = 0; x < this.size; x++) {
      row.push(qr.C.UNDEFINED_MODULE);
    }
    matrix.push(row);
  }
  return matrix;
};


qr.Encoder.prototype.placeFunctionPatterns_ = function() {
  this.placeFinderPattern_(0, 0);
  this.placeFinderPattern_(this.size - 7, 0);
  this.placeFinderPattern_(0, this.size - 7);
  this.placeAlignmentPatterns_();
  this.placeTimingPattern_(true);
  this.placeTimingPattern_(false);
  this.placeDarkModule_();
};


qr.Encoder.prototype.placeFinderPattern_ = function(startX, startY) {
  for (var y = 0; y < qr.C.FINDER_PATTERN_SIZE; y++) {
    for (var x = 0; x < qr.C.FINDER_PATTERN_SIZE; x++) {
      var mx = startX + x;
      var my = startY + y;
      this.matrix[my][mx] = qr.C.FINDER_PATTERN[y][x];
    }
  }
  this.placeStrip_(7, 0, true);
  this.placeStrip_(this.size - 8, 0, true);
  this.placeStrip_(0, 7, false);
  this.placeStrip_(this.size - 8, 7, false);
  this.placeStrip_(0, this.size - 8, false);
  this.placeStrip_(7, this.size - 8, true);
};


qr.Encoder.prototype.placeStrip_ = function(row, col, isHorizontal) {
  for (var i = 0; i < 8; i++) {
    if (isHorizontal) {
      this.matrix[row][col + i] = 0;
    } else {
      this.matrix[row + i][col] = 0;
    }
  }
};


qr.Encoder.prototype.placeAlignmentPatterns_ = function() {
  var locations = qr.C.ALIGNMENT_PATTERN_LOCATIONS[this.version];
  for (var y = 0; y < locations.length; y++) {
    for (var x = 0; x < locations.length; x++) {
      var centerX = locations[x];
      var centerY = locations[y];
      if (this.matrix[centerY][centerX] == qr.C.UNDEFINED_MODULE) {
        this.placeAlignmentPattern_(centerX, centerY);
      }
    }
  }
};


qr.Encoder.prototype.placeAlignmentPattern_ = function(centerX, centerY) {
  var startX = centerX - Math.floor(qr.C.ALIGNMENT_PATTERN[0].length / 2);
  var startY = centerY - Math.floor(qr.C.ALIGNMENT_PATTERN.length / 2);
  for (var y = 0; y < qr.C.ALIGNMENT_PATTERN.length; y++) {
    for (var x = 0; x < qr.C.ALIGNMENT_PATTERN[y].length; x++) {
      var mx = startX + x;
      var my = startY + y;
      this.matrix[my][mx] = qr.C.ALIGNMENT_PATTERN[y][x];
    }
  }
};


qr.Encoder.prototype.placeTimingPattern_ = function(isHorizontal) {
  for (var i = 7; i < this.size - 7; i++) {
    if (isHorizontal) {
      this.matrix[6][i] = ((i % 2 == 0) ? 1 : 0);
    } else {
      this.matrix[i][6] = ((i % 2 == 0) ? 1 : 0);
    }
  }
};


qr.Encoder.prototype.placeDarkModule_ = function() {
  this.matrix[this.size - 8][8] = 1;
};


qr.Encoder.prototype.placeReservedAreas_ = function() {
  var formatLocations = this.getInitialFormatLocations_();
  for (var i = 0; i < formatLocations.length; i++) {
    var loc = formatLocations[i];
    while (loc != null) {
      this.matrix[loc.y][loc.x] = qr.C.RESERVED_FORMAT;
      loc = this.getNextFormatLocation_(loc);
    }
  }
  var versionLocations = this.getInitialVersionLocations_();
  for (var i = 0; i < versionLocations.length; i++) {
    var loc = versionLocations[i];
    while (loc != null) {
      this.matrix[loc.y][loc.x] = qr.C.RESERVED_VERSION;
      loc = this.getNextVersionLocation_(loc);
    }
  }
};


qr.Encoder.prototype.getInitialFormatLocations_ = function() {
  return [
    {x: 8, y: 0},
    {x: this.size - 1, y: 8}
  ];
};


qr.Encoder.prototype.getNextFormatLocation_ = function(loc) {
  if (loc.x == 8) {
    if (loc.y == 5) return {x: 8, y: 7};
    if (loc.y == 8) return {x: 8, y: this.size - 7};
    if (loc.y == this.size - 1) return null;
    return {x: 8, y: loc.y + 1};
  } else if (loc.y == 8) {
    if (loc.x == this.size - 8) return {x: 7, y: 8};
    if (loc.x == 7) return {x: 5, y: 8};
    if (loc.x == 0) return null;
    return {x: loc.x - 1, y: 8};
  }
  return null;
};


qr.Encoder.prototype.getInitialVersionLocations_ = function() {
  if (this.version < 7) return [];
  return [
    {x: this.size - 11, y: 0},
    {x: 0, y: this.size - 11}
  ];
};


qr.Encoder.prototype.getNextVersionLocation_ = function(loc) {
  var x = loc.x;
  var y = loc.y;
  if (x < 6) {
    if (++y == this.size - 8) {
      y = this.size - 11;
      if (++x == 6) return null;
    }
    return {x: x, y: y};
  } else if (y < 6) {
    if (++x == this.size - 8) {
      x = this.size - 11;
      if (++y == 6) return null;
    }
    return {x: x, y: y};
  }
  return null;
};


qr.Encoder.prototype.placeFormatAndVersionStrings_ = function(matrix, maskIndex) {
  var formatString = this.computeFormatString_(this.ecl, maskIndex);
  var formatLocations = this.getInitialFormatLocations_();
  for (var i = 0; i < formatLocations.length; i++) {
    var loc = formatLocations[i];
    var stringIndex = formatString.length - 1;
    while (loc != null) {
      matrix[loc.y][loc.x] = formatString[stringIndex--];
      loc = this.getNextFormatLocation_(loc);
    }
  }
  var versionString = this.computeVersionString_(this.version);
  if (versionString.length > 0) {
    var versionLocations = this.getInitialVersionLocations_();
    for (var i = 0; i < versionLocations.length; i++) {
      var loc = versionLocations[i];
      var stringIndex = versionString.length - 1;
      while (loc != null) {
        matrix[loc.y][loc.x] = versionString[stringIndex--];
        loc = this.getNextVersionLocation_(loc);
      }
    }
  }
};


// Fills the matrix in with the structured data.
qr.Encoder.prototype.fillData_ = function() {
  // Start in the lower right.
  var bitIndex = 0;
  var isGoingUp = true;
  var colIndex = this.size - 1;
  var xOffset = 0;
  var y = this.size - 1;
  while (colIndex > 0) {
    var x = colIndex - xOffset;
    if (this.matrix[y][x] == qr.C.UNDEFINED_MODULE) {
      var nextByte = this.structuredData[Math.floor(bitIndex / 8)];
      var nextBit = nextByte & (1 << (7 - bitIndex % 8)) ? 1 : 0;
      this.matrix[y][x] = nextBit;
      this.dataMask[y][x] = 1;
      bitIndex++;
    }

    // Get the next location.
    if (++xOffset > 1) {
      xOffset = 0;
      if (isGoingUp) {
        if (--y < 0) {
          isGoingUp = false;
          y = 0;
          colIndex -= 2;
          if (colIndex == 6) colIndex--;  // Skip over the vertical timing bar.
        }
      } else {
        if (++y >= this.size) {
          isGoingUp = true;
          y = this.size - 1;
          colIndex -= 2;
        }
      }
    }
  }
};


qr.Encoder.prototype.generateMasks_ = function() {
  this.masks = [];
  for (var i = 0; i < qr.C.MASK_FUNCTIONS.length; i++) {
    var maskedMatrix = this.createMatrix_();
    for (var y = 0; y < this.size; y++) {
      for (var x = 0; x < this.size; x++) {
        var value = this.matrix[y][x];
        var maskedValue = qr.C.MASK_FUNCTIONS[i](y, x) ? this.invertModule_(value) : value;
        maskedMatrix[y][x] = this.isDataOrErrorBit_(y, x) ? maskedValue : value;
      }
    }
    this.placeFormatAndVersionStrings_(maskedMatrix, i);
    this.masks.push(maskedMatrix);
  }
};


qr.Encoder.prototype.isDataOrErrorBit_ = function(row, col) {
  return this.dataMask[row][col] == 1;
};


qr.Encoder.prototype.invertModule_ = function(value) {
  if (value < 0) return value;
  return (value + 1) % 2;
};


qr.Encoder.prototype.computePenaltyScores_ = function() {
  this.penaltyScores = [];
  var bestScore = undefined;
  for (var i = 0; i < this.masks.length; i++) {
    var score = this.computePenaltyScore_(this.masks[i]);
    this.penaltyScores.push(score);
    if (bestScore == undefined || score < bestScore) {
      bestScore = score;
      this.bestMaskIndex = i;
    }
  }
};


qr.Encoder.prototype.computePenaltyScore_ = function(matrix) {
  return this.computeRule1_(matrix) +
         this.computeRule2_(matrix) +
         this.computeRule3_(matrix) +
         this.computeRule4_(matrix);
};


qr.Encoder.prototype.computeRule1_ = function(matrix) {
  var score = 0;
  var streakType = 0;
  var streakLength = 0;
  // Horizontal direction.
  for (var y = 0; y < this.size; y++) {
    for (var x = 0; x < this.size; x++) {
      if (matrix[y][x] == streakType) {
        streakLength++;
        if (streakLength == 5) score += 3;
        else if (streakLength > 5) score++;
      } else {
        streakType = matrix[y][x];
        streakLength = 1;
      }
    }
  }
  streakLength = 0;
  // Vertical direction.
  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      if (matrix[y][x] == streakType) {
        streakLength++;
        if (streakLength == 5) score += 3;
        else if (streakLength > 5) score++;
      } else {
        streakType = matrix[y][x];
        streakLength = 1;
      }
    }
  }
  return score;
};


qr.Encoder.prototype.computeRule2_ = function(matrix) {
  var score = 0;
  for (var y = 0; y < this.size - 1; y++) {
    for (var x = 0; x < this.size - 1; x++) {
      if (matrix[y][x] == matrix[y][x + 1] &&
          matrix[y][x] == matrix[y + 1][x] &&
          matrix[y][x] == matrix[y + 1][x + 1]) {
        score += 3;
      }
    }
  }
  return score;
};


qr.Encoder.prototype.computeRule3_ = function(matrix) {
  var score = 0;
  var k;
  // Horizontal direction.
  for (var y = 0; y < this.size; y++) {
    for (var x = 0; x <= this.size - qr.C.PENALTY_PATTERN_SIZE; x++) {
      for (k = 0; k < qr.C.PENALTY_PATTERN_SIZE; k++) {
        if (matrix[y][x + k] != qr.C.PENALTY_PATTERNS[0][k]) break;
      }
      if (k == qr.C.PENALTY_PATTERN_SIZE) score += qr.C.PENALTY_SCORE;

      for (k = 0; k < qr.C.PENALTY_PATTERN_SIZE; k++) {
        if (matrix[y][x + k] != qr.C.PENALTY_PATTERNS[1][k]) break;
      }
      if (k == qr.C.PENALTY_PATTERN_SIZE) score += qr.C.PENALTY_SCORE;
    }
  }
  // Vertical direction.
  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y <= this.size - qr.C.PENALTY_PATTERN_SIZE; y++) {
      for (k = 0; k < qr.C.PENALTY_PATTERN_SIZE; k++) {
        if (matrix[y + k][x] != qr.C.PENALTY_PATTERNS[0][k]) break;
      }
      if (k == qr.C.PENALTY_PATTERN_SIZE) score += qr.C.PENALTY_SCORE;

      for (k = 0; k < qr.C.PENALTY_PATTERN_SIZE; k++) {
        if (matrix[y + k][x] != qr.C.PENALTY_PATTERNS[1][k]) break;
      }
      if (k == qr.C.PENALTY_PATTERN_SIZE) score += qr.C.PENALTY_SCORE;
    }
  }
  return score;
};


qr.Encoder.prototype.computeRule4_ = function(matrix) {
  var totalModules = this.size * this.size;
  var darkModules = 0;
  for (var y = 0; y < this.size; y++) {
    for (var x = 0; x < this.size; x++) {
      if (matrix[y][x] == 1) darkModules++;
    }
  }
  var darkPercent = (darkModules * 100) / totalModules;
  var m1 = Math.floor(darkPercent / 5) * 5;
  var m2 = Math.ceil(darkPercent / 5) * 5;
  return Math.min(Math.abs(m1 - 50), Math.abs(m2 - 50)) * 2;
};


qr.Encoder.prototype.generateMaskedMatrix_ = function() {
  this.maskedMatrix = [];
  var bestMask = this.masks[this.bestMaskIndex];
  for (var y = 0; y < this.size; y++) {
    var row = [];
    for (var x = 0; x < this.size; x++) {
      row.push(bestMask[y][x]);
    }
    this.maskedMatrix.push(row);
  }
};


qr.Encoder.prototype.drawMatrix = function(canvas, drawSize) {
  var ctx = canvas.getContext('2d');
  var width = canvas.width = (this.size + 2 * qr.C.QUIET_ZONE_SIZE) * drawSize;
  var height = canvas.height = (this.size + 2 * qr.C.QUIET_ZONE_SIZE) * drawSize;

  // Clear the canvas.
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, width, height);

  // Draw the matrix.
  ctx.fillStyle = '#000';
  for (var y = 0; y < this.size; y++) {
    for (var x = 0; x < this.size; x++) {
      if (this.maskedMatrix[y][x] == 1) {
        ctx.fillRect((qr.C.QUIET_ZONE_SIZE + x) * drawSize, (qr.C.QUIET_ZONE_SIZE + y) * drawSize, drawSize, drawSize);
      }
    }
  }
};


qr.Encoder.prototype.drawMatrixOverlay = function(canvas, overlayMatrix, drawSize, color) {
  var ctx = canvas.getContext('2d');
  // Draw the overlay.
  ctx.fillStyle = color;
  //ctx.translate(drawSize * qr.C.QUIET_ZONE_SIZE, drawSize * qr.C.QUIET_ZONE_SIZE);
  for (var y = 0; y < this.size; y++) {
    for (var x = 0; x < this.size; x++) {
      var value = overlayMatrix[y][x];
      if (value == 0 || value == 1) {
        ctx.fillStyle = value == 1 ? color : '#FFF';
        ctx.fillRect((qr.C.QUIET_ZONE_SIZE + x) * drawSize, (qr.C.QUIET_ZONE_SIZE + y) * drawSize, drawSize, drawSize);
      }
    }
  }
};
