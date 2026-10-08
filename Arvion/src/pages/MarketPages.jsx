import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import brandingLogo from '../../arvion-logo/arvion-logo.jpeg'
import { supabase } from '../lib/supabase'
import '../market.css'

const IMAGE_BUCKET = 'market-listing-images'
const LISTING_SELECT = 'id,seller_id,title,description,price_minor,currency,category_id,location_area,location_city,location_state,location_country,condition,status,created_at,updated_at,category:categories(name,slug),images:market_listing_images(id,storage_path,sort_order)'

function Brand() {
  return (
    <Link to="/welcome" className="market-brand" aria-label="Return to your Arvion home">
      <img src={brandingLogo} alt="" />
      <span>Arvion</span>
    </Link>
  )
}

function MarketHeader({ active = 'market' }) {
  return (
    <header className="market-header">
      <div className="market-header-inner">
        <Brand />
        <nav className="market-nav" aria-label="Arvion areas">
          <Link to="/welcome">Home</Link>
          <Link to="/market" className={active === 'market' ? 'active' : ''}>Market</Link>
          <Link to="/local">Local</Link>
        </nav>
        <Link className="market-sell-button" to="/market/new">Sell on Arvion <span aria-hidden="true">＋</span></Link>
      </div>
    </header>
  )
}

function formatPrice(priceMinor, currency = 'NGN') {
  const amount = Number(priceMinor)
  if (!Number.isSafeInteger(amount) || amount < 0) {
    return `${currency} —`
  }

  const whole = Math.floor(amount / 100)
  const minor = String(amount % 100).padStart(2, '0')
  try {
    const formattedWhole = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(whole)
    return `${formattedWhole}.${minor}`
  } catch {
    return `${currency} ${whole.toLocaleString('en-NG')}.${minor}`
  }
}

function formatCondition(condition = '') {
  return condition.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function listingLocation(listing) {
  return [listing.location_area, listing.location_city, listing.location_state, listing.location_country].filter(Boolean).join(', ')
}

function useListingImages(images = []) {
  const pathsKey = JSON.stringify(
    [...images].sort((first, second) => (first.sort_order ?? 0) - (second.sort_order ?? 0)).map((image) => image.storage_path),
  )
  const [imageUrls, setImageUrls] = useState([])

  useEffect(() => {
    let isCurrent = true
    const loadImages = async () => {
      const paths = JSON.parse(pathsKey)
      if (!supabase || paths.length === 0) {
        setImageUrls([])
        return
      }
      const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(paths, 3600)
      if (!isCurrent) return
      setImageUrls(error ? [] : (data || []).map((item) => item.signedUrl).filter(Boolean))
    }

    loadImages()
    return () => {
      isCurrent = false
    }
  }, [pathsKey])

  return imageUrls
}

function ListingImage({ listing, className = '' }) {
  const images = useListingImages(listing.images || [])
  return images[0]
    ? <img className={className} src={images[0]} alt={listing.title} />
    : <div className={`${className} market-image-placeholder`} aria-label="No product image available"><span aria-hidden="true">▦</span></div>
}

function ListingCard({ listing }) {
  return (
    <Link className="market-listing-card" to={`/market/${listing.id}`}>
      <ListingImage listing={listing} className="market-listing-image" />
      <div className="market-listing-copy">
        <div className="market-listing-meta">
          <span>{listing.category?.name || 'Market'}</span>
          {listing.condition ? <span>{formatCondition(listing.condition)}</span> : null}
        </div>
        <h3>{listing.title}</h3>
        <strong className="market-listing-price">{formatPrice(listing.price_minor, listing.currency)}</strong>
        <span className="market-listing-location">{listingLocation(listing) || 'Location not provided'}</span>
      </div>
    </Link>
  )
}

export function MarketPage() {
  const [categories, setCategories] = useState([])
  const [listings, setListings] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState('')
  const [listingsError, setListingsError] = useState('')

  useEffect(() => {
    let isCurrent = true
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id,name,slug,sort_order')
        .eq('domain', 'MARKET')
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (!isCurrent) return
      if (error) setCategoriesError(error.message || 'Market categories could not be loaded.')
      else setCategories(data || [])
    }
    loadCategories()
    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    let isCurrent = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setListingsError('')
      let query = supabase
        .from('market_listings')
        .select(LISTING_SELECT)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(100)

      if (categoryId) query = query.eq('category_id', categoryId)
      const titleQuery = search.trim().replace(/[\\%_]/g, '\\$&')
      if (titleQuery) query = query.ilike('title', `%${titleQuery}%`)

      const { data, error } = await query
      if (!isCurrent) return
      if (error) {
        setListingsError(error.message || 'Market listings could not be loaded.')
        setListings([])
      } else {
        setListings(data || [])
      }
      setLoading(false)
    }, search.trim() ? 250 : 0)

    return () => {
      isCurrent = false
      window.clearTimeout(timer)
    }
  }, [categoryId, search])

  return (
    <div className="market-shell">
      <MarketHeader />
      <main className="market-main">
        <section className="market-hero">
          <div>
            <span className="market-eyebrow">Discover something good</span>
            <h1>Market</h1>
            <p>Buy what you need from people and businesses across Arvion.</p>
          </div>
          <Link to="/market/new" className="market-hero-sell">＋ <span>Sell on Arvion</span></Link>
        </section>

        <section className="market-search-section" aria-label="Search Market listings">
          <label className="market-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search phones, laptops, furniture..."
              aria-label="Search listings by title"
            />
            {search ? <button type="button" onClick={() => setSearch('')} aria-label="Clear search">×</button> : null}
          </label>
          <span className="market-search-hint">Try “iPhone 15 Pro” or “office chair”</span>
        </section>

        <section className="market-categories" aria-label="Filter by category">
          <div className="market-section-title">
            <div><span>Browse</span><h2>Categories</h2></div>
          </div>
          <div className="market-category-list">
            <button type="button" className={!categoryId ? 'selected' : ''} onClick={() => setCategoryId('')}>All items</button>
            {categories.map((category) => (
              <button
                type="button"
                key={category.id}
                className={categoryId === category.id ? 'selected' : ''}
                onClick={() => setCategoryId(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
          {categoriesError ? <p className="market-inline-error" role="alert">{categoriesError}</p> : null}
        </section>

        <section className="market-results" aria-labelledby="market-listings-title">
          <div className="market-results-heading">
            <div><span>Fresh finds</span><h2 id="market-listings-title">Newest listings</h2></div>
            <span className="market-sort-label">Newest first <span aria-hidden="true">↓</span></span>
          </div>
          {listingsError ? <div className="market-alert" role="alert">{listingsError}</div> : null}
          {loading ? <p className="market-status" role="status">Loading Market listings…</p> : null}
          {!loading && !listingsError && listings.length > 0 ? (
            <div className="market-listing-grid">{listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div>
          ) : null}
          {!loading && !listingsError && listings.length === 0 ? (
            <div className="market-empty">
              <span className="market-empty-icon" aria-hidden="true">▦</span>
              <span className="market-eyebrow">A fresh start</span>
              <h3>{search || categoryId ? 'No matching listings yet' : 'Nothing here yet'}</h3>
              <p>{search || categoryId ? 'Try another search or browse all Market listings.' : 'Be the first to list something on Arvion Market.'}</p>
              <div>
                {(search || categoryId) ? <button type="button" className="market-secondary-button" onClick={() => { setSearch(''); setCategoryId('') }}>Browse all items</button> : null}
                <Link to="/market/new" className="market-primary-button">Sell on Arvion</Link>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  )
}

export function MarketListingDetailPage() {
  const { listingId } = useParams()
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const imageUrls = useListingImages(listing?.images || [])

  useEffect(() => {
    let isCurrent = true
    const loadListing = async () => {
      setLoading(true)
      setError('')
      const { data, error: queryError } = await supabase
        .from('market_listings')
        .select(LISTING_SELECT)
        .eq('id', listingId)
        .maybeSingle()
      if (!isCurrent) return
      if (queryError) setError(queryError.message || 'This listing could not be loaded.')
      else setListing(data)
      setLoading(false)
    }
    loadListing()
    return () => {
      isCurrent = false
    }
  }, [listingId])

  return (
    <div className="market-shell">
      <MarketHeader />
      <main className="market-main market-detail-main">
        <Link to="/market" className="market-back-link">← Back to Market</Link>
        {loading ? <p className="market-status" role="status">Loading listing…</p> : null}
        {error ? <div className="market-alert" role="alert">{error}</div> : null}
        {!loading && !error && !listing ? (
          <div className="market-empty"><h1>Listing not found</h1><p>This listing may no longer be available.</p><Link to="/market" className="market-primary-button">Explore Market</Link></div>
        ) : null}
        {!loading && listing ? (
          <article className="market-detail">
            <div className="market-detail-gallery">
              {imageUrls.length
                ? imageUrls.map((url) => <img key={url} src={url} alt={listing.title} />)
                : <div className="market-detail-placeholder" aria-label="No product images available"><span aria-hidden="true">▦</span></div>}
            </div>
            <div className="market-detail-copy">
              <div className="market-listing-meta">
                <span>{listing.category?.name || 'Market'}</span>
                {listing.condition ? <span>{formatCondition(listing.condition)}</span> : null}
              </div>
              <h1>{listing.title}</h1>
              <strong className="market-detail-price">{formatPrice(listing.price_minor, listing.currency)}</strong>
              <div className="market-detail-facts">
                <div><span>Location</span><strong>{listingLocation(listing) || 'Not provided'}</strong></div>
                <div><span>Condition</span><strong>{formatCondition(listing.condition) || 'Not specified'}</strong></div>
                <div><span>Listing status</span><strong>{formatCondition(listing.status)}</strong></div>
              </div>
              <section className="market-description">
                <h2>About this item</h2>
                <p>{listing.description || 'The seller has not added a description.'}</p>
              </section>
              <div className="market-seller-note">Listed by an Arvion seller</div>
            </div>
          </article>
        ) : null}
      </main>
    </div>
  )
}

function parsePriceMinor(value) {
  const match = value.trim().match(/^(\d{1,17})(?:\.(\d{1,2}))?$/)
  if (!match) return null
  const minor = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'))
  if (minor <= 0n || minor > 9223372036854775807n) return null
  return minor.toString()
}

function safeFileName(fileName) {
  return fileName.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(-100) || 'image'
}

export function CreateMarketListingPage({ session }) {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [currency, setCurrency] = useState('NGN')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [condition, setCondition] = useState('')
  const [area, setArea] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('Nigeria')
  const [files, setFiles] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true
    const loadFormData = async () => {
      const [{ data: categoryData, error: categoryError }, { data: profile, error: profileError }] = await Promise.all([
        supabase.from('categories').select('id,name,sort_order').eq('domain', 'MARKET').eq('active', true).order('sort_order'),
        supabase.from('profiles').select('currency').eq('auth_user_id', session.user.id).maybeSingle(),
      ])
      if (!isCurrent) return
      if (categoryError) setError(categoryError.message || 'Market categories could not be loaded.')
      if (profileError) setError(profileError.message || 'Your account preferences could not be loaded.')
      setCategories(categoryData || [])
      if (profile?.currency) setCurrency(profile.currency)
      setLoadingCategories(false)
    }
    loadFormData()
    return () => {
      isCurrent = false
    }
  }, [session.user.id])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    const priceMinor = parsePriceMinor(price)
    const normalizedCurrency = currency.trim().toUpperCase()
    const selectedFiles = Array.from(files)

    if (title.trim().length < 3) {
      setError('Title must be at least 3 characters.')
      return
    }
    if (title.trim().length > 120) {
      setError('Title must be 120 characters or fewer.')
      return
    }
    if (description.trim().length < 10) {
      setError('Description must be at least 10 characters.')
      return
    }
    if (description.trim().length > 5000) {
      setError('Description must be 5,000 characters or fewer.')
      return
    }
    if (!area.trim()) {
      setError('Area is required.')
      return
    }
    if (!condition) {
      setError('Choose an item condition.')
      return
    }
    if (!['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'FOR_PARTS'].includes(condition)) {
      setError('Choose a valid item condition.')
      return
    }
    if (!categoryId) {
      setError('Choose a Market category.')
      return
    }
    if (!country.trim()) {
      setError('Country is required.')
      return
    }
    if (priceMinor === null) {
      setError('Enter a positive price with up to two decimal places.')
      return
    }
    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      setError('Enter a valid three-letter currency code, such as NGN.')
      return
    }
    if (selectedFiles.length > 5 || selectedFiles.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setError('Choose up to 5 JPG, PNG, or WebP images, each no larger than 5 MB.')
      return
    }

    setSubmitting(true)
    let listingId
    const uploadedPaths = []
    try {
      const { data: listing, error: insertError } = await supabase
        .from('market_listings')
        .insert({
          seller_id: session.user.id,
          title: title.trim(),
          description: description.trim(),
          price_minor: priceMinor,
          currency: normalizedCurrency,
          category_id: categoryId,
          condition,
          location_area: area.trim(),
          location_city: city.trim() || null,
          location_state: state.trim() || null,
          location_country: country.trim(),
          status: 'ACTIVE',
        })
        .select('id')
        .single()
      if (insertError) throw insertError
      listingId = listing.id

      for (const [index, file] of selectedFiles.entries()) {
        const path = `${listingId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
        const { error: uploadError } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
          contentType: file.type,
          upsert: false,
        })
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`)
        uploadedPaths.push({ path, sort_order: index })
      }

      if (uploadedPaths.length) {
        const { error: imageError } = await supabase.from('market_listing_images').insert(
          uploadedPaths.map(({ path, sort_order }) => ({
            listing_id: listingId,
            storage_path: path,
            url: supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl,
            sort_order,
          })),
        )
        if (imageError) throw new Error(`Image details could not be saved: ${imageError.message}`)
      }

      navigate(`/market/${listingId}`, { replace: true })
    } catch (caughtError) {
      const cleanupErrors = []
      if (uploadedPaths.length) {
        const { error: cleanupError } = await supabase.storage.from(IMAGE_BUCKET).remove(uploadedPaths.map(({ path }) => path))
        if (cleanupError) cleanupErrors.push(`Uploaded images may need cleanup: ${cleanupError.message}`)
      }
      if (listingId) {
        const { error: deleteError } = await supabase.from('market_listings').delete().eq('id', listingId)
        if (deleteError) cleanupErrors.push(`The listing was created but could not be removed: ${deleteError.message}`)
      }
      const listingError = caughtError.message?.startsWith('Image upload failed:')
        ? 'Your listing image could not be uploaded. Please try a smaller supported image.'
        : caughtError.message?.startsWith('Image details could not be saved:')
          ? 'Your listing was created, but its image information could not be saved.'
          : 'Your listing could not be created. Check the required details and try again.'
      setError([listingError, ...cleanupErrors].join(' '))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="market-shell">
      <MarketHeader active="sell" />
      <main className="market-main market-form-main">
        <Link to="/market" className="market-back-link">← Back to Market</Link>
        <section className="market-form-intro">
          <span className="market-eyebrow">Share it with Arvion</span>
          <h1>Sell on Arvion</h1>
          <p>Give your item a clear description so buyers know exactly what to expect.</p>
        </section>
        <form className="market-form" onSubmit={handleSubmit} noValidate>
          <div className="market-form-section">
            <h2>Item details</h2>
            <label className="market-field">
              <span>Product title <b>*</b></span>
              <input minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. iPhone 14 Pro, 256 GB" required />
            </label>
            <label className="market-field">
              <span>Description <b>*</b></span>
              <textarea minLength={10} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="Describe the item, its features, and anything a buyer should know." required />
            </label>
            <div className="market-field-grid">
              <label className="market-field">
                <span>Category <b>*</b></span>
                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required disabled={loadingCategories || !categories.length}>
                  <option value="">Select a category</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label className="market-field">
                <span>Condition <b>*</b></span>
                <select value={condition} onChange={(event) => setCondition(event.target.value)} required>
                  <option value="" disabled>Select condition</option>
                  <option value="NEW">New</option>
                  <option value="LIKE_NEW">Like New</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="FOR_PARTS">For Parts</option>
                </select>
              </label>
            </div>
          </div>
          <div className="market-form-section">
            <h2>Price & location</h2>
            <div className="market-field-grid">
              <label className="market-field">
                <span>Price <b>*</b></span>
                <input type="text" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" required />
              </label>
              <label className="market-field">
                <span>Currency <b>*</b></span>
                <input maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} placeholder="NGN" required />
              </label>
              <label className="market-field">
                <span>Area <b>*</b></span>
                <input value={area} onChange={(event) => setArea(event.target.value)} placeholder="e.g. Ikeja" required />
              </label>
              <label className="market-field">
                <span>City</span>
                <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Lagos" />
              </label>
              <label className="market-field">
                <span>State / region</span>
                <input value={state} onChange={(event) => setState(event.target.value)} placeholder="e.g. Lagos" />
              </label>
              <label className="market-field">
                <span>Country <b>*</b></span>
                <input value={country} onChange={(event) => setCountry(event.target.value)} required />
              </label>
            </div>
          </div>
          <div className="market-form-section">
            <h2>Product images <span>Optional</span></h2>
            <label className="market-field">
              <span>Upload up to 5 images</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(event.target.files || [])} />
              <small>JPG, PNG, or WebP. Maximum 5 MB each. Images are stored privately and shown using secure links.</small>
            </label>
            {files.length ? <p className="market-file-count">{files.length} image{files.length === 1 ? '' : 's'} selected</p> : null}
          </div>
          {error ? <div className="market-alert" role="alert">{error}</div> : null}
          <div className="market-form-actions">
            <button className="market-primary-button" type="submit" disabled={submitting || loadingCategories || !categories.length}>
              {submitting ? 'Creating listing…' : 'Create listing'}
            </button>
            <Link to="/market" className="market-cancel-link">Cancel</Link>
          </div>
          <p className="market-seller-security">Your listing is associated with your signed-in Arvion account.</p>
        </form>
      </main>
    </div>
  )
}
