package iters_test

import (
	"database/sql"

	"github.com/dennwc/iters"
)

// statically assert that interface matches
var _ iters.RowsScanner = (*sql.Rows)(nil)
