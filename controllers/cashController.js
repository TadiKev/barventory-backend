export const saveCash = asyncHandler(async (req, res) => {
  const { barId, date, amount } = req.body;
  const user = req.user._id;
  const d = new Date(date); d.setUTCHours(0,0,0,0);
  const rec = await CashCount.findOneAndUpdate(
    { bar: barId, date: d },
    { amount, recordedBy: user },
    { upsert: true, new: true }
  );
  res.json(rec);
});
