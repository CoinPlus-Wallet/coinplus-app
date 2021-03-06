import { sha256 } from 'js-sha256';
import { Buffer } from 'safe-buffer';
import bs58 from 'bs58';
import CoinKey from 'coinkey';
import Decimal from 'decimal.js';
import computePrivateKeySec256k1 from './computePrivateKeySec256k1';

export const bitcoinExp = Decimal(10 ** 8);

const getWif = async (secret1B58, secret2B58) => {
  const privkeyB256 = await computePrivateKeySec256k1(secret1B58, secret2B58);
  const formats = {
    bitcoin: { first: [128], compressed: true },
    litecoin: { first: [176], compressed: true },
    tezos: { first: [17, 162, 224, 201], compressed: false },
    bitcoincash: { first: [128], compressed: true },
  };
  // eslint-disable-next-line prefer-const
  let outputs = {};
  let toDigest;
  let doublesha256;
  let finalPrivkeyB256;
  Object.keys(formats).forEach(format => {
    if (formats[format].compressed) {
      toDigest = [
        ...formats[format].first,
        ...privkeyB256.toArray('be', 32),
        1,
      ];
    } else {
      toDigest = [...formats[format].first, ...privkeyB256.toArray('be', 32)];
    }
    doublesha256 = sha256.digest(sha256.digest(toDigest));
    finalPrivkeyB256 = [...toDigest, ...doublesha256.slice(0, 4)];

    outputs[format] = bs58.encode(Buffer.from(finalPrivkeyB256));
  });
  return outputs;
};

const getWifBTC = async (secret1B58, secret2B58) => {
  const { bitcoin } = await getWif(secret1B58, secret2B58);
  return bitcoin;
};

const getPublicKeyFromWif = wif => {
  const ck = CoinKey.fromWif(wif);
  return ck.publicAddress;
};

const isValidPublicAddress = address => {
  if (!address) return false;

  try {
    const decoded = bs58.decode(address);
    if (decoded.length !== 25) return false;

    const checksum = Buffer.from(decoded.slice(decoded.length - 4));
    const body = decoded.slice(0, decoded.length - 4);
    const goodChecksum = Buffer.from(
      sha256.digest(sha256.digest(body)).slice(0, 4),
    );
    if (decoded[0] !== 0x00 && decoded[0] !== 0x05) {
      return false;
    }
    return Buffer.compare(checksum, goodChecksum) === 0;
  } catch (e) {
    return false;
  }
};

const historyURL = 'https://live.blockcypher.com/btc/address/';
const getBalance = address => {
  return fetch(
    `https://api.blockcypher.com/v1/btc/main/addrs/${address}/balance`,
  )
    .then(response => {
      return response.json();
    })
    .then(result => {
      return {
        finalBalance: Decimal(result.final_balance).div(bitcoinExp).toString(),
        unconfirmedBalance: Decimal(result.unconfirmed_balance)
          .div(bitcoinExp)
          .toString(),
      };
    });
};

export default {
  getWif,
  getWifBTC,
  getPublicKeyFromWif,
  isValidPublicAddress,
  getBalance,
  historyURL,
};
