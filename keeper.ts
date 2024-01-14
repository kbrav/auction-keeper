
import { send, N, wad, ray, rad, BANKYEAR, wait, warp, mine, RAY } from 'minihat'
import { b32, snapshot, revert } from 'minihat'
import bn from 'bignumber.js'
const dpack = require('@etherpacks/dpack')
import * as ethers from 'ethers'
const debug = require('debug')('keeper:run')

let pack, dapp
let bank, strat
let mdn, fb, ploker
let uniwrap
let ali
let ilkinfos : IlkInfos = {}
type BigNumber = ethers.BigNumber
const BigNumber = ethers.BigNumber
const constants = ethers.constants
const PALM = [
    'NewPalm0(bytes32,bytes32)',
    'NewPalm1(bytes32,bytes32,bytes32)',
    'NewPalm2(bytes32,bytes32,bytes32,bytes32)',
    'NewPalmBytes2(bytes32,bytes32,bytes32,bytes)'
].map(ethers.utils.id)
const [PALM0, PALM1, PALM2, PALMBYTES2] = PALM
const FLOG = ethers.utils.id('NewFlog(address,bytes4,bytes)')
const FLIP_FAILED = ethers.utils.id('FlipFailed(bytes)')



let par : BigNumber
let way : BigNumber
let tau : BigNumber
let how : BigNumber
let tip : { src: Address, tag: string }

type Ilk = string
type Address = `0x${string}`


type Urn = {
    art : BigNumber;
}
type Urns = {[u: Address]: Urn}

type ERC20Info = {
    gem: Address,
    amt: BigNumber
}

interface Hook {
    getFeeds() :FeedPtr[];
    getIlkFeeds(i :Ilk) :FeedPtr[];
    getUrnFeeds(i :Ilk, u :Address) :FeedPtr[];
    cut(i :Ilk, u :Address) :BigNumber;
    dipIlk(i :Ilk) :boolean
    dipUrn(i :Ilk, u :Address) :boolean
    ink :{[i: Ilk]: {[u: Address]: any}}
    updateUrn(i :Ilk, u :Address);
    updateIlk(i :Ilk);
    profitable(
      i :string,
      u :Address,
      cut :BigNumber,
      bill :BigNumber,
      deal :BigNumber
    ) :boolean;
    getGems(i :Ilk, u :Address) :Address[];
}

type Item = {
    gem: Address
    src: Address
    tag: string
    liqr: BigNumber
}

class ERC20Hook implements Hook {
    public items: {[key: Ilk]: Item} = {}
    public ink :{[i: Ilk]: {[u: Address]: BigNumber}} = {}
    public minprofit :BigNumber

    constructor(minprofit :BigNumber) {
        this.minprofit = minprofit
    }

    getFeeds() :FeedPtr[] {
        return [].concat(...Object.keys(this.items).map(i => this.getIlkFeeds(i)))
    }

    getIlkFeeds(i :Ilk) :FeedPtr[] {
        return [{src: this.items[i].src, tag: this.items[i].tag}]
    }

    getUrnFeeds(i :Ilk, u :Address) :FeedPtr[] {
        return this.getIlkFeeds(i)
    }

    cut(i :Ilk, u :Address) :BigNumber {
        let item = this.items[i]
        let feed = feeds[item.src][item.tag]
        if (!this.ink[i]) this.ink[i] = {}
        if (!this.ink[i][u]) this.ink[i][u] = ethers.constants.Zero
        return this.ink[i][u].mul(feed.val).mul(RAY).div(item.liqr)
    }
    dipIlk(i :Ilk) :boolean {
        return true
        /*
        let item = this.items[i]
        let feed = feeds[item.src][item.tag]
        if (feed.dip) {
            feed.dip = false
            return true
        }
        return false
       */
    }
    dipUrn(i :Ilk, u :Address) :boolean {
        throw Error('unimplemented dipUrn')
    }
    async updateUrn(i :Ilk, u :Address) {
        throw Error('unimplemented updateUrn')
    }
    async updateIlk(i :Ilk) {
        throw Error('unimplemented updateIlk')
    }

    profitable(
      i :string,
      u :Address,
      cut :BigNumber,
      bill :BigNumber,
      deal :BigNumber
    ) :boolean {
        return deal.lt(RAY)
    }


    getGems(i :Ilk, u :Address) :Address[] {
        return [this.items[i].gem]
    }
}

type UniV3NFTs = {[key: string]: {token0: ERC20Info, token1: ERC20Info}}
type Amounts = { t0: Address, t1: Address, a0: BigNumber, a1: BigNumber }
type UniV3Source = { src: Address, tag: string, liqr: BigNumber }

class UniV3NFTHook implements Hook {
    public sources: { [i: Ilk]: { [gem: Address]: UniV3Source } } = {}
    // tokenId => (token0, token1)
    public nfts :UniV3NFTs = {}
    public ink :{[i: Ilk]: {[u: Address]: BigNumber[]}} = {}
    public wrap : ethers.Contract
    public minprofit
    public nfpm : ethers.Contract
    public hookContract : ethers.Contract
    public bank : ethers.Contract
    public uniwrap : ethers.Contract

    constructor(
      bank :ethers.Contract,
      minprofit :BigNumber,
      uniwrap :ethers.Contract,
      nfpm :ethers.Contract
    ) {
        this.bank = bank
        this.minprofit = minprofit
        this.uniwrap = uniwrap
        this.nfpm = nfpm
    }

    getFeeds(): FeedPtr[] {
        return [].concat(...Object.keys(this.sources).map(i => this.getIlkFeeds(i)))
    }

    getIlkFeeds(i :Ilk) :FeedPtr[] {
        if (!this.sources[i]) this.sources[i] = {}
        return Object.values(this.sources[i])
    }

    getUrnFeeds(i :Ilk, u :Address) :FeedPtr[] {
        return this.ink[i][u].map(tokenId => {
            let token0 = this.nfts[tokenId.toString()].token0
            let token1 = this.nfts[tokenId.toString()].token1
            let source0 = this.sources[i][token0.gem]
            let source1 = this.sources[i][token1.gem]
            return [
                {src: source0.src, tag: source0.tag},
                {src: source1.src, tag: source1.tag}
            ]
        }).flat()
    }

    cut(i :Ilk, u :Address) :BigNumber {
        let res = ethers.constants.Zero

        for (let tokenId of this.ink[i][u]) {
            let {token0, token1} = this.nfts[tokenId.toString()]
            let source0 = this.sources[i][token0.gem]
            let source1 = this.sources[i][token1.gem]
            let feed0 = feeds[source0.src][source0.tag]
            let feed1 = feeds[source1.src][source1.tag]
            res = res.add(feed0.val.mul(token0.amt).mul(RAY).div(source0.liqr))
            res = res.add(feed1.val.mul(token1.amt).mul(RAY).div(source1.liqr))
        }
        return res
    }

    dipIlk(i :Ilk) :boolean {
        return true
        /*
        let ilkfeeds = this.getIlkFeeds(i)
        for (let fptr of ilkfeeds) {
            let feed = feeds[fptr.src][fptr.tag]
            if (feed && feed.dip) {
                feed.dip = false
                return true
            }
        }
        return false
       */
    }

    dipUrn(i :Ilk, u :Address) :boolean {
        throw Error('unimplemented dipUrn')
    }

    async updateUrn(i :Ilk, u :Address) {
        throw Error('unimplemented updateUrn')
    }

    async updateIlk(i :Ilk) {
        throw Error('unimplemented updateIlk')
    }

    profitable(
      i :string,
      u :Address,
      cut :BigNumber,
      bill :BigNumber,
      deal :BigNumber
    ) :boolean {
        return deal.lt(RAY)
    }

    getGems(i :Ilk, u :Address) :Address[] {
        let ink = this.ink[i][u]
        return this.ink[i][u].map(tokenId => {
            let {token0, token1} = this.nfts[tokenId.toString()]
            return [token0.gem, token1.gem]
        }).flat()
    }

    async amounts(i :Ilk, tokenId :BigNumber) {
        const [,,t0, t1,,,,,,,,] = await this.nfpm.positions(tokenId)
        const src0 = this.sources[i][t0.toLowerCase()]
        const src1 = this.sources[i][t1.toLowerCase()]

        const feed0 = feeds[src0.src][src0.tag]
        const feed1 = feeds[src1.src][src1.tag]
        const p0    = feed0.val
        const p1    = feed1.val

        const x96 = BigNumber.from(2).pow(96)
        const ratioX96 = p0.mul(x96).div(p1)
        const sqrtRatioX96 = BigNumber.from(bn(ratioX96.mul(x96).toString())
          .sqrt().integerValue().toFixed().toString()
        )

        const [a0, a1] = await this.uniwrap.total(
            this.nfpm.address, tokenId, sqrtRatioX96
        )

        return [t0, t1, a0, a1]

    }



}

let hooks : {[hookname: string]: Hook} = {}
type IlkInfo = {
    hook: string,
    urns: Urns,
    rack: BigNumber,
    liqr: BigNumber,
    fee: BigNumber,
    chop: BigNumber
}

type Feed = {val: BigNumber, ttl: BigNumber, dip: boolean }
type Feeds = {[src: Address]: {[tag: string]: Feed}}
type FeedPtr = {src: Address, tag: string}
let feeds : Feeds = {};

type IlkInfos = {[key: Ilk]: IlkInfo}

const xtos = (_ilk) : string => {
    let ilk = _ilk
    if (typeof(_ilk) == 'string') {
        ilk = Buffer.from(_ilk.slice(2), 'hex')
    }
    let last = ilk.indexOf(0)
    let sliced = last == -1 ? ilk : ilk.slice(0, last)
    return sliced.toString('utf8')
}

// listen for frob flog
const sigs = {
    frob: 'frob(bytes32,address,bytes,int256)',
    bail: 'bail(bytes32,address)',
    file: 'file(bytes32,bytes32)',
    filk: 'filk(bytes32,bytes32,uint256)',
    init: 'init(bytes32,address)'
}
const topic = (name) => ethers.utils.id(sigs[name]).slice(0,10) + '00'.repeat(28)

const processpalm = async (_palm) => {
    const id = _palm.topics[0]
    if (id == PALM0) {
        const palm = bank.interface.decodeEventLog('NewPalm0', _palm.data, _palm.topics)
        const key = xtos(palm.key)
        const val = palm.val
        if (key == 'par') {
            par = BigNumber.from(val)
        } else if (key == 'way') {
            way = BigNumber.from(val)
        } else if (key == 'tau') {
            tau = BigNumber.from(val)
        } else if (key == 'how') {
            how = BigNumber.from(val)
        } else if (key == 'tip.src') {
            tip.src = val.slice(0, 42)
        } else if (key == 'tip.tag') {
            tip.tag = xtos(val)
        } else {
            debug(`palm0: ${key} not handled`)
        }
    } else if (id == PALM1) {
        const palm = bank.interface.decodeEventLog('NewPalm1', _palm.data, _palm.topics)
        const key = xtos(palm.key)
        const val = palm.val
        const idx0 = xtos(palm.idx0)
        if (!ilkinfos[idx0]) return
        const info : IlkInfo = ilkinfos[idx0]
        if (key == 'rack') {
            info.rack = BigNumber.from(val)
        } else if (key == 'fee') {
            info.fee = BigNumber.from(val)
        } else if (key == 'chop') {
            info.chop = BigNumber.from(val)
        } else if (idx0 == 'weth') {

            let erc20hook :ERC20Hook = hooks['erc20hook.0'] as ERC20Hook
            if (!erc20hook.items[idx0]) {
                erc20hook.items[idx0] = {
                    gem: ethers.constants.AddressZero,
                    src: ethers.constants.AddressZero,
                    tag: ethers.constants.HashZero,
                    liqr: ethers.constants.Zero
                }
            }

            let item = erc20hook.items[idx0]
            if (key == 'gem') {
                item.gem = val.slice(0, 42)
            } else if (key == 'src') {
                item.src = val.slice(0, 42)
            } else if (key == 'tag') {
                item.tag = xtos(val)
            } else if (key == 'liqr') {
                item.liqr = BigNumber.from(val)
            } else {
                debug(`palm1: ${key} not handled for idx ${idx0}`)
            }

        } else {
            debug(`palm1: ${key} not handled`)
        }
    } else if (id == PALM2) {
        const palm = bank.interface.decodeEventLog('NewPalm2', _palm.data, _palm.topics)
        const key = xtos(palm.key)
        const val = palm.val
        const idx0 = palm.idx0
        const idx1 = palm.idx1
        const i = xtos(idx0)
        const u = idx1.slice(0, 42)
        if (key == 'art') {
            if (!ilkinfos[i].urns) ilkinfos[i].urns = {}
            if (!ilkinfos[i].urns[u]) ilkinfos[i].urns[u] = {art: ethers.constants.Zero}
            ilkinfos[i].urns[u].art = BigNumber.from(val)
        } else if (xtos(idx0) == ':uninft') {
            let uninfthook :UniV3NFTHook = hooks['uninfthook.0'] as UniV3NFTHook
            let gem = u
            if (!uninfthook.sources[i]) uninfthook.sources[i] = {}
            if (!uninfthook.sources[i][gem]) {
                uninfthook.sources[i][gem] = {
                    src: constants.AddressZero,
                    tag: constants.HashZero,
                    liqr: constants.Zero
                }
            }

            let source = uninfthook.sources[i][gem]
            if (key == 'src') {
                source.src = val.slice(0, 42)
            } else if (key == 'tag') {
                source.tag = xtos(val)
            } else if (key == 'liqr') {
                source.liqr = BigNumber.from(val)
            } else {
                debug(`palm2: ${key} not handled for idx ${xtos(idx0)},${idx1}`)
            }
        } else {
            debug(`palm2: ${key} not handled`)
        }
    } else if (id == PALMBYTES2) {
        const palm = bank.interface.decodeEventLog('NewPalmBytes2', _palm.data, _palm.topics)
        const key = xtos(palm.key)
        const val = palm.val
        const idx0 = palm.idx0
        const idx1 = palm.idx1
        const i = xtos(idx0)
        const u = idx1.slice(0, 42)
        const info :IlkInfo = ilkinfos[i]
        if (key == 'ink') {

            if (i === 'weth') {

                const hook :ERC20Hook = hooks[info.hook] as ERC20Hook
                if (!hook.ink) hook.ink = {}
                if (!hook.ink[i]) hook.ink[i] = {}
                hook.ink[i][u] = BigNumber.from(val)

            } else if (i === ':uninft') {

                const hook :UniV3NFTHook= hooks[info.hook] as UniV3NFTHook
                if (!hook.ink) hook.ink = {}
                if (!hook.ink[i]) hook.ink[i] = {}

                let tokenIds = ethers.utils.defaultAbiCoder.decode(['uint[]'], val)[0]

                let proms = tokenIds.map(tokenId => new Promise(async (resolve, reject) => {
                    try {
                        let [t0, t1, a0, a1] = await hook.amounts(i, tokenId)
                        debug("OK")
                        hook.nfts[tokenId.toString()] = {
                            token0: {gem: t0.toLowerCase(), amt: a0},
                            token1: {gem: t1.toLowerCase(), amt: a1}
                        }
                        resolve(null)
                    } catch (e) {
                        debug("palm uni ink fail")
                        debug(e)
                    }
                }))
                await Promise.all(proms)
                hook.ink[i][u] = tokenIds
            } else {
                debug(`palmbytes2: ${key} not handled for ilk ${i}`)
            }
        } else {
            debug(`palmbytes2: ${key} not handled`)
        }
    } else {
        debug(`palm: ${id} unrecognized (palms are ${PALM})`)
    }
}

const fastpow = (n :BigNumber, dt :BigNumber) => {
    if (dt.eq(0)) return RAY
    if (dt.mod(2).eq(1)) return fastpow(n, dt.div(2)).mul(n).div(RAY)
    else return fastpow(n, dt.div(2))
}

let ndairicos = 0
const processpush = (_push, tol) => {
    const push = fb.interface.decodeEventLog('Push', _push.data, _push.topics)
    const src = push.src.toLowerCase()
    const tag = xtos(push.tag)
    if (!feeds[src]) {
        feeds[src] = {}
    }
    if (!feeds[src][tag]) {
        feeds[src][tag] = {
            val: ethers.constants.Zero,
            ttl: ethers.constants.MaxUint256,
            dip: false,
        }
    }
    let feed = feeds[src][tag]
    let nextval = BigNumber.from(push.val)
    let nextttl = BigNumber.from(push.ttl)
    if (tol.gt(0) && feed.val.gt(0)) {
        let dipamt = feed.val.sub(nextval).mul(RAY).div(feed.val)
        if (!way.lt(RAY)) {
            let now = BigNumber.from(Math.ceil(Date.now() / 1000))
            let parjump = fastpow(way, now.sub(tau))
            dipamt = dipamt.mul(parjump).div(RAY)
        }
        feed.dip = dipamt.gt(tol)
    }
    feed.val = nextval
    feed.ttl = nextttl
}

const gettime = async () => {
    return (await ali.provider.getBlock('latest')).timestamp
}

const DISCOUNT = ray(0.999999)
const profitable = (i :string, sell :BigNumber, earn :BigNumber) => {
    return sell.gt(0)
    /*
    // TODO expand
    let info : IlkInfo = ilkinfos[i]
    let feed : Feed = feeds[info.src][info.tag]
    let ask = earn.mul(RAY).div(sell)
    let mark = feed.val
    debug(`    profitable ? ask=${ask} market=${mark} discount=${DISCOUNT}`)
    if (ask.mul(RAY).div(mark).lt(DISCOUNT)) {
        debug(`        ...yes`)
        return true
    }
    return false
   */
}

// check if an ilk's price feed has changed beyond some tolerance
// if it has, loop through the tracked urns under said ilk,
// deleting the empty ones, and bailing the sufficiently unsafe ones
const scanilk = async (i :string) => {
    let info :IlkInfo = ilkinfos[i]
    let hook :Hook = hooks[info.hook]
    if (Object.keys(info.urns).length == 0) return []
    let proms = []
    if (hook.dipIlk(i)) {
        // TODO figure out when to unset dip
        for (let _u in info.urns) {
            let u = _u as Address
            let urn = info.urns[u]
            //let [safe, deal, cut] = await bank.callStatic.safe(b32(i), u)
            // div by ray once for each rmul in vat safe
            debug(`checking urn (${i},${u}): ink=${hook.ink[i][u]}, art=${urn.art}`)
            debug(`    par=${par}, rack=${info.rack}, liqr=${info.liqr}`)
            let tab = urn.art.mul(par).mul(info.rack).div(ray(1))
            let cut = hook.cut(i, u)
            debug(`    tab=${tab}, cut=${cut}, so it's ${tab.gt(cut) ? 'not ': ''}safe`)
            if (tab.gt(cut)) {
                // unsafe
                let deal = RAY
                if (tab.gt(RAY)) {
                    deal = cut.div(tab.div(RAY))
                }
                debug(`    deal=${deal}`)
                // check expected profit
                let bill = info.chop.mul(urn.art).mul(info.rack).div(ray(1).pow(2))
                if (hook.profitable(i, u, cut, bill, deal)) {
                    let urnfeeds :FeedPtr[] = hook.getUrnFeeds(i, u)
                    let gems :Address[] = hook.getGems(i, u)
                    let srcs = urnfeeds.map(f => f.src)
                    let tags = urnfeeds.map(f => ethers.utils.hexlify(b32(f.tag)))
                    proms.push(new Promise(async (resolve, reject) => {
                        let res
                        try {
                            // seems like gas estimator doesn't do well with raw calls that
                            // don't bubble up errors...
                            let fliptype = 0
                            if (i.startsWith(':uninft')) fliptype = 1
                            let tx = await send(
                                strat.fill_flip, b32(i), u, [], [], fliptype, {gasLimit: 1000000000}
                            )
                            for (let event of tx.events) {
                                if (event.topics[0] == FLIP_FAILED) {
                                    throw Error(event.data)
                                }
                            }
                            debug(`fill_flip success on urn (${i},${u})`)
                        } catch (e) {
                            debug(`failed to flip urn (${i}, ${u})`)
                            debug(e)
                        }
                        resolve(null)
                    }))
                    debug('    pushed fill_flip')
                }
            }
        }
    }

    return proms
}


const create_path = (tokens, fees) => {
    if (!tokens.length == fees.length + 1) throw Error('create_path tokens fees length mismatch')

    let fore = '0x'
    let rear = '0x'
    for (let i = 0; i < tokens.length - 1; i++) {
      fore = ethers.utils.solidityPack(
          ['bytes', 'address', 'uint24'], [fore, tokens[i], fees[i]]
      );
    }
    fore = ethers.utils.solidityPack(
      ['bytes', 'address'], [fore, tokens[tokens.length - 1]]
    );

    rear = ethers.utils.solidityPack(
      ['bytes', 'address'], [rear, tokens[tokens.length - 1]]
    );
    for (let j = tokens.length - 1; j > 0; j--) {
      rear = ethers.utils.solidityPack(
          ['bytes', 'uint24', 'address'], [rear, fees[j - 1], tokens[j - 1]]
      );
    }

    return {fore, rear}
}

const join_pool = async (args) => {
    let nfpm = args.nfpm
    let ethers = args.ethers
    let ali = args.ali
    debug('join_pool')
    if (ethers.BigNumber.from(args.a1.token).gt(ethers.BigNumber.from(args.a2.token))) {
      let a = args.a1;
      args.a1 = args.a2;
      args.a2 = a;
    }

    let spacing = args.tickSpacing;
    let tickmax = 887220
    // full range liquidity
    let tickLower = -tickmax;
    let tickUpper = tickmax;
    let token1 = await ethers.getContractAt('Gem', args.a1.token)
    let token2 = await ethers.getContractAt('Gem', args.a2.token)
    debug('approve tokens ', args.a1.token, args.a2.token)
    await send(token1.approve, nfpm.address, ethers.constants.MaxUint256);
    await send(token2.approve, nfpm.address, ethers.constants.MaxUint256);
    let timestamp = await gettime()
    debug('nfpm mint')
    let [tokenId, liquidity, amount0, amount1] = await nfpm.callStatic.mint([
          args.a1.token, args.a2.token,
          args.fee,
          tickLower, tickUpper,
          args.a1.amountIn, args.a2.amountIn,
          0, 0, ali.address, timestamp + 1000
    ]);

    await send(nfpm.mint, [
          args.a1.token, args.a2.token,
          args.fee,
          tickLower, tickUpper,
          args.a1.amountIn, args.a2.amountIn,
          0, 0, ali.address, timestamp + 1000
    ]);

    return {tokenId, liquidity, amount0, amount1}
}



const run_keeper = async (args) => {

    debug('schedule')
    debug('network name:', args.netname)
    ali = args.signer
    if (!ali) {
        const provider = new ethers.providers.JsonRpcProvider(args.url)
        ali = ethers.Wallet.fromMnemonic(args.mnemonic).connect(provider)
    }

    pack = require(`./pack/strat_${args.netname}.dpack.json`)
    dapp = await dpack.load(pack, ethers, ali)
    bank = dapp.bank
    strat = dapp.strat
    mdn = dapp.mdn
    fb = dapp.feedbase
    ploker = dapp.ploker
    uniwrap = dapp.uniswapV3Wrapper

    let erc20hook = new ERC20Hook(BigNumber.from(args.minprofit))
    let nfpm = dapp._types.NonfungiblePositionManager.attach(
        dapp.nonfungiblePositionManager.address
    );
    let nfthook   = new UniV3NFTHook(
        bank.address, BigNumber.from(args.minprofit), dapp.uniwrapper, nfpm
    )
    hooks['erc20hook.0'] = erc20hook
    hooks['uninfthook.0'] = nfthook


    await send(dapp.rico.approve, bank.address, ethers.constants.MaxUint256)
    await send(dapp.risk.approve, bank.address, ethers.constants.MaxUint256)

    let ilks = args.ilks.split(';')
    for (let i of ilks) {
        const bankilk = await bank.ilks(b32(i))
        ilkinfos[i] = {
            // src and tag of feed to pull from
            urns: {},
            hook: i.startsWith(':uninft') ? 'uninfthook.0' : 'erc20hook.0',
            rack: bankilk.rack,
            liqr: bankilk.liqr,
            fee: bankilk.fee,
            chop: bankilk.chop
        }
    }
 

    par = await bank.par()
    way = await bank.way()
    tau = await bank.tau()
    how = await bank.how()
    const _tip = await bank.tip()
    tip = { src: _tip.src, tag: xtos(_tip.tag) }

    ilks.forEach(i => ilkinfos[i].urns = {})

    const bankfilter = {
        address: bank.address,
        topics: [PALM]
    }
    let events = await bank.queryFilter(bankfilter)
    for (let event of events) {
        try {
            processpalm(event)
        } catch (e) {
            debug('run_keeper: failed to process event')
            //debug(e)
        }
    }

    bank.on(bankfilter, async (event) => { 
        try {
            processpalm(event)
        } catch (e) {
            debug('bank.on: failed to process event')
            //debug(e)
        }
    })

    let feedptrs = hooks['erc20hook.0'].getFeeds().concat(
        hooks['uninfthook.0'].getFeeds()
    )

    let srcs = feedptrs.map(f => ethers.utils.hexZeroPad(f.src, 32))
    let tags = feedptrs.map(f => ethers.utils.hexlify(b32(f.tag)))
    const fbfilter = {
        address: fb.address,
        topics: [null,null,null]
    }
    events = await fb.queryFilter(fbfilter)
    for (let event of events) {
        try {
            processpush(event, args.tol)
        } catch (e) {
            debug('run_keeper: failed to process push')
            //debug(e)
        }
    }


    fb.on(fbfilter, async (push) => {
        try {
            processpush(push, args.tol)
        } catch (e) {
            debug('fb.on: failed to process push (2)')
            //debug(e)
        }
        
    })

    const scheduleflip = async () => {
        try {
            let proms = Object.keys(ilkinfos).map(scanilk)
            await Promise.all(proms)
        } catch (e) {
            debug('scanilk failed:')
            debug(e)
        }
        setTimeout(scheduleflip, args.fliptime)
    }

    const scheduleflop = async () => {
        try {
            let [ricogain, riskgain] = await strat.callStatic.fill_flop()
            if (ricogain > args.expected_rico || riskgain > args.expected_risk) {
                await send(strat.fill_flop)
            }
        } catch (e) {
            debug('doflop failed:')
            //debug(e)
        }
        setTimeout(scheduleflop, args.floptime)
    }

    const scheduleflap = async () => {
        try {
            let [ricogain, riskgain] = await strat.callStatic.fill_flap([])
            if (ricogain > args.expected_rico || riskgain > args.expected_risk) {
                await send(strat.fill_flap, [])
            }
        } catch (e) {
            //debug('doflap failed:')
            //debug(e)
        }
        setTimeout(scheduleflap, args.flaptime)
    }

    if (args.fliptime) scheduleflip()
    if (args.flaptime) scheduleflap()
    if (args.floptime) {
        scheduleflop()
    }
}

export { run_keeper, create_path, join_pool }
