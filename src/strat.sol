/// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.8.20;
import {Vow} from './lib/ricobank/src/vow.sol';
import {Vat} from './lib/ricobank/src/vow.sol';
import {File} from './lib/ricobank/src/file.sol';
import {Vat} from './lib/ricobank/src/vat.sol';
import {Vow} from './lib/ricobank/src/vow.sol';

// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.19;

import { ISwapRouter } from './TEMPinterface.sol';
import './mixin/ward.sol';

abstract contract UniSwapper is Ward {
    struct Path {
        bytes fore;
        bytes rear;
    }
    enum SwapKind {EXACT_IN, EXACT_OUT}
    // tokIn -> kind -> Path
    mapping(address tokIn => mapping(address tokOut => Path)) public paths;

    uint256 public constant SWAP_ERR = type(uint256).max;

    ISwapRouter public router;

    function setPath(address tokIn, address tokOut, bytes calldata fore, bytes calldata rear)
      _ward_ external {
        Path storage path = paths[tokIn][tokOut];
        path.fore = fore;
        path.rear = rear;
    }

    function setSwapRouter(address r)
      _ward_ external {
        router = ISwapRouter(r);
    }

    function _swap(address tokIn, address tokOut, address receiver, SwapKind kind, uint amt, uint limit)
            internal returns (uint256 result) {
        if (kind == SwapKind.EXACT_IN) {
            ISwapRouter.ExactInputParams memory params =
                ISwapRouter.ExactInputParams({
                    path : paths[tokIn][tokOut].fore,
                    recipient : receiver,
                    deadline : block.timestamp,
                    amountIn : amt,
                    amountOutMinimum : limit
                });
            try router.exactInput(params) returns (uint res) {
                result = res;
            } catch {
                result = SWAP_ERR;
            }
        } else {
            ISwapRouter.ExactOutputParams memory params =
                ISwapRouter.ExactOutputParams({
                    path: paths[tokIn][tokOut].rear,
                    recipient: receiver,
                    deadline: block.timestamp,
                    amountOut: amt,
                    amountInMaximum: limit
                });

            try router.exactOutput(params) returns (uint res) {
                result = res;
            } catch {
                result = SWAP_ERR;
            }
        }
    }
}


contract Strat is UniSwapper, Math {
    address payable public bank;
    Gem rico;
    Gem risk;
    error ErrSwap();
    error ErrBail();
    error ErrFlap();
    error ErrFlop();

    constructor(address payable bank) {
        rico = File(bank).rico();
        risk = Vow(bank).RISK();
        rico.approve(bank, type(uint).max);
        risk.approve(bank, type(uint).max);
    }

    function fill_flip(bytes32 i, address u) external {
        return Vat(bank).flash(address(this), abi.encodeWithSelector(
            Strat.bail.selector, i, u, msg.sender
        );
    }

    function fill_flop(bytes32[] calldata ilks) external {
        Vat(bank).flash(address(this), abi.encodeWithSelector(
            Strat.flop.selector, msg.sender
        );
    }

    function fill_flap(bytes32[] calldata ilks) external {
        Vat(bank).flash(address(this), abi.encodeWithSelector(
            Strat.flap.selector, msg.sender
        );
    }

    function bail(bytes32 i, address u, uint usr) external {
        Vat(bank).drip(i);
        address gem = abi.decode(Vat(bank).gethi('gem', i), (address));
        uint ricobefore = rico.balanceOf(address(this);
        Vow(bank).bail(i, u);

        // swap to replenish what was paid for the flip
        uint ricospent = ricobefore - rico.balanceOf(address(this));
        uint ink = Gem(gem).balanceOf(address(this));
        uint res = _swap(gem, rico, SwapKind.EXACT_OUT, ricospent, ink);
        if (res == SWAP_ERR) revert ErrSwap();

        // give back the extra funds to caller
        uint ricobal = rico.balanceOf(address(this));
        uint MINT = Vat(bank).MINT();
        if (ricobal < MINT) revert ErrBail();
        rico.transfer(usr, ricobal - MINT);
        Gem(gem).transfer(usr, Gem(gem).balanceOf(address(this)));
    }

    function flop(address usr) external {
        bytes32[] memory ilks = new bytes32[](0);
        uint ricobefore = rico.balanceOf(address(this));
        Vat(bank).keep(ilks);
        uint ricospent = ricobefore - rico.balanceOf(address(this));

        uint res = _swap(
            address(risk), address(rico), SwapKind.EXACT_OUT,
            ricospent, risk.balanceOf(address(this))
        );
        if (res == SWAP_ERR) revert ErrSwap();

        uint ricobal = rico.balanceOf(address(this));
        uint MINT = Vat(bank).MINT();
        if (ricobal < MINT) revert ErrFlop();
        rico.transfer(usr, ricobal - MINT);
        risk.transfer(usr, risk.balanceOf(address(this)));
    }

    function flap(address usr) external {
        uint ricobefore = rico.balanceOf(address(this));
        uint flaprico = rico.balanceOf(address(bank)) - Vat(bank).sin() / RAY;
        uint rush;  uint price;
        {
            uint debt = Vat(bank).debt();
            uint rush = Vat(bank).debt() + flaprico / debt;
            (bytes32 val,) = fb.pull(Vow(bank).flapsrc, Vow(bank).flaptag);
            price = uint(val);
        }

        uint res = _swap(
            address(rico), address(risk), SwapKind.EXACT_OUT, price * flaprico / rush, type(uint).max
        );
        if (res == SWAP_ERR) revert ErrSwap();

        uint ricospent0 = ricobefore - rico.balanceOf(address(this));
        uint riskspent;
        {
            uint riskbefore = risk.balanceOf(address(this));
            bytes32[] memory ilks = new bytes32[](0);
            Vat(bank).keep(ilks);
            riskspent = riskbefore - risk.balanceOf(address(this));
        }

        _swap(address(risk), address(rico), SwapKind.EXACT_OUT, ricospent0, type(uint).max);

        uint ricobal = rico.balanceOf(address(this));
        uint MINT = Vat(bank).MINT();
        if (ricobal < MINT) revert ErrFlap();
        rico.transfer(usr, ricobal - MINT);
        risk.transfer(usr, risk.balanceOf(address(this)));
    }

}


