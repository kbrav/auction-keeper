# This file is part of Maker Keeper Framework.
#
# Copyright (C) 2018 reverendus, bargst
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

import logging
from pprint import pformat
from typing import Optional

from auction_keeper.process import Process
from pyflex import Address
from pyflex.numeric import Wad, Ray, Rad


class Parameters:
    def __init__(self, collateral_auction_house: Optional[Address], surplus_auction_house: Optional[Address],
                 debt_auction_house: Optional[Address], id: int):
        assert isinstance(collateral_auction_house, Address) or (collateral_auction_house is None)
        assert isinstance(surplus_auction_house, Address) or (surplus_auction_house is None)
        assert isinstance(debt_auction_house, Address) or (debt_auction_house is None)
        assert isinstance(id, int)

        self.collateral_auction_house = collateral_auction_house
        self.surplus_auction_house = surplus_auction_house
        self.debt_auction_house = debt_auction_house
        self.id = id

    def __eq__(self, other):
        assert isinstance(other, Parameters)

        return self.collateral_auction_house == other.collateral_auction_house and \
               self.surplus_auction_house == other.surplus_auction_house and \
               self.debt_auction_house == other.debt_auction_house and \
               self.id == other.id

    def __hash__(self):
        return hash((self.collateral_auction_house, self.surplus_auction_house, self.debt_auction_house, self.id))

    def __repr__(self):
        return pformat(vars(self))

class Status():
    def __init__(self,
                 id: int,
                 collateral_auction_house: Optional[Address],
                 surplus_auction_house: Optional[Address],
                 debt_auction_house: Optional[Address],
                 bid_amount: Wad,
                 amount_to_sell: Wad,
                 amount_to_raise: Optional[Wad],
                 bid_increase: Optional[Wad],
                 bid_decrease: Optional[Wad],
                 high_bidder: Optional[Address],
                 block_time: int,
                 bid_expiry: Optional[int],
                 auction_deadline: int,
                 price: Optional[Wad],
                 sold_amount: Optional[Wad]=None,
                 raised_amount: Optional[Rad]=None):
        assert isinstance(id, int)
        assert isinstance(collateral_auction_house, Address) or (collateral_auction_house is None)
        assert isinstance(surplus_auction_house, Address) or (surplus_auction_house is None)
        assert isinstance(debt_auction_house, Address) or (debt_auction_house is None)
        # Numeric type of bid and amount_to_sell depends on auction type; system coin values are bid in Rad, collateral and prot in Wad.
        assert isinstance(bid_amount, Wad) or isinstance(bid_amount, Rad) or bid_amount is None
        assert isinstance(amount_to_sell, Wad) or isinstance(amount_to_sell, Rad)
        assert isinstance(amount_to_raise, Rad) or (amount_to_raise is None)
        assert isinstance(sold_amount, Wad) or (sold_amount is None)
        assert isinstance(raised_amount, Rad) or (raised_amount is None)
        assert isinstance(bid_increase, Wad) or bid_increase is None
        assert isinstance(bid_decrease, Wad) or bid_decrease is None
        assert isinstance(high_bidder, Address) or high_bidder is None
        assert isinstance(block_time, int)
        assert isinstance(bid_expiry, int) or bid_expiry is None
        assert isinstance(auction_deadline, int)
        assert isinstance(price, Wad) or (price is None)

        self.id = id
        self.collateral_auction_house = collateral_auction_house
        self.surplus_auction_house = surplus_auction_house
        self.debt_auction_house = debt_auction_house
        self.bid_amount = bid_amount
        self.amount_to_sell = amount_to_sell
        self.amount_to_raise = amount_to_raise
        self.sold_amount = sold_amount
        self.raised_amount = raised_amount
        self.bid_increase = bid_increase
        self.bid_decrease = bid_decrease
        self.high_bidder = high_bidder
        self.block_time = block_time
        self.bid_expiry = bid_expiry
        self.auction_deadline = auction_deadline
        self.price = price

        #super().__init__()

    def __repr__(self):
        return pformat(vars(self))

    def __eq__(self, other):
        assert isinstance(other, Status)

        return self.id == other.id and \
               self.collateral_auction_house == other.collateral_auction_house and \
               self.surplus_auction_house == other.surplus_auction_house and \
               self.debt_auction_house == other.debt_auction_house and \
               self.bid == other.bid and \
               self.amount_to_sell == other.amount_to_sell and \
               self.amount_to_raise == other.amount_to_raise and \
               self.bid_increase == other.bid_increase and \
               self.bid_decrease == other.bid_decrease and \
               self.high_bidder == other.high_bidder and \
               self.block_time == other.block_time and \
               self.bid_expiry == other.bid_expiry and \
               self.auction_deadline == other.auction_deadline and \
               self.price == other.price

    def __hash__(self):
        return hash((self.id,
                     self.collateral_auction_house,
                     self.surplus_auction_house,
                     self.debt_auction_house,
                     self.bid,
                     self.amount_to_sell,
                     self.amount_to_raise,
                     self.bid_increase,
                     self.bid_decrease,
                     self.high_bidder,
                     self.block_time,
                     self.bid_expiry,
                     self.auction_deadline,
                     self.price))
    def to_dict(self):

        record = {
            "id": str(self.id),
            "bid_amount": str(self.bid_amount),
            "amount_to_sell": str(self.amount_to_sell),
            "block_time": int(self.block_time),
            "auction_deadline": int(self.auction_deadline),
            "price": str(self.price) if self.price is not None else None,
        }

        if self.bid_increase:
            record['bid_increase'] = str(self.bid_increase)

        if self.bid_decrease:
            record['bid_decrease'] = str(self.bid_decrease)

        if self.high_bidder:
            record['high_bidder'] = str(self.high_bidder)

        if self.bid_expiry:
            record['bid_expiry'] = str(self.bid_expiry)

        if self.amount_to_raise:
            record['amount_to_raise'] = str(self.amount_to_raise)

        if self.collateral_auction_house:
            record['collateral_auction_house'] = str(self.collateral_auction_house)

        if self.surplus_auction_house:
            record['surplus_auction_house'] = str(self.surplus_auction_house)

        if self.debt_auction_house:
            record['debt_auction_house'] = str(self.debt_auction_house)

        return record

class Stance:
    def __init__(self, price: Optional[Wad], gas_price: Optional[int]):
        assert isinstance(price, Wad) or (price is None)
        assert isinstance(gas_price, int) or (gas_price is None)

        self.price = price
        self.gas_price = gas_price

    def __eq__(self, other):
        assert isinstance(other, Stance)

        return self.price == other.price and \
               self.gas_price == other.gas_price

    def __hash__(self):
        return hash((self.price, self.gas_price))

    def __repr__(self):
        return pformat(vars(self))


class Model:
    logger = logging.getLogger()

    def __init__(self, command: str, parameters: Parameters):
        assert isinstance(command, str)
        assert isinstance(parameters, Parameters)

        self._command = command
        self._arguments = f"--id {parameters.id}"
        self._arguments += f" --collateral_auction_house {parameters.collateral_auction_house}" if parameters.collateral_auction_house is not None else ""
        self._arguments += f" --surplus_auction_house {parameters.surplus_auction_house}" if parameters.surplus_auction_house is not None else ""
        self._arguments += f" --debt_auction_house {parameters.debt_auction_house}" if parameters.debt_auction_house is not None else ""
        self._last_output = None

        self.logger.info(f"Instantiated model using process '{self._command} {self._arguments}'")

        self._process = Process(f"{self._command} {self._arguments}")
        self._process.start()

    def _ensure_process_running(self):
        if not self._process.running:
            self.logger.warning(f"Process '{self._command} {self._arguments}' is down, restarting it")

            self._process.start()

    def send_status(self, input: Status):
        assert isinstance(input, Status)

        self._ensure_process_running()

        record = input.to_dict()

        self._process.write(record)

    def get_stance(self) -> Optional[Stance]:
        self._ensure_process_running()

        while True:
            data = self._process.read()

            if data is not None:
                self._last_output = Stance(price=Wad.from_number(data['price']) if 'price' in data else None,
                                           gas_price=int(data['gasPrice']) if 'gasPrice' in data else None)

            else:
                break

        return self._last_output

    def terminate(self):
        self.logger.info(f"Terminating model using process '{self._command} {self._arguments}'")

        self._process.stop()


class ModelFactory:
    def __init__(self, command: str):
        assert isinstance(command, str)

        self.command = command

    def create_model(self, parameters: Parameters) -> Model:
        return Model(self.command, parameters)
