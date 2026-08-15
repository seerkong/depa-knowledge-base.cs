# Invalid: BusinessObject Field Ref

Expected diagnostic intent: reject a `BusinessObject` that uses `Field@ref`. A BusinessObject directly declares its class fields; it is not a wrapper that reselects fields from a shadow `Type`.
